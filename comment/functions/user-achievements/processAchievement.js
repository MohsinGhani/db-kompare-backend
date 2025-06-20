/**
 * achievementEventProcessor.js
 * 
 * Purpose:
 *   - Receive achievement events from the client (LOGIN, GEMS, XP)
 *   - Record each event in DynamoDB for a complete history
 *   - Atomically update the corresponding user counters (consecutive-days, streaks, gems, XP)
 *   - Apply 3-day build-up streak logic on login and schedule an expiry notification
 *   - Return the new counter values back to the caller
 */

import { TABLE_NAME } from "../../helpers/constants.js";
import {
  createItemInDynamoDB,
  updateItemInDynamoDB,
  getItem,
} from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";
import { DateTime } from "luxon";

// Lead time before streak expiry to warn the user (in seconds)
const DEFAULT_STREAK_LEAD_TIME_SEC = 3 * 60 * 60; // 3 hours

export const handler = async (event) => {
  try {
    // ──────────────────────────────────────────────────────────
    // 1) Parse & validate input
    // ──────────────────────────────────────────────────────────
    const {
      userId,      // String: unique user identifier
      eventType,   // One of: "LOGIN", "GEMS", "XP"
      delta,       // Number: amount of GEMS/XP earned (ignored for LOGIN)
      reason       // String (optional): context/source of this event
    } = JSON.parse(event.body || "{}");

    if (!userId || !["LOGIN","GEMS","XP"].includes(eventType)) {
      return sendResponse(400,
        "Missing or invalid fields: userId, eventType must be LOGIN | GEMS | XP"
      );
    }
    if ((eventType === "GEMS" || eventType === "XP") &&
        (typeof delta !== "number" || delta <= 0)) {
      return sendResponse(400,
        "For GEMS/XP events, delta must be a positive number"
      );
    }

    // ──────────────────────────────────────────────────────────
    // 2) Generate timestamps
    // ──────────────────────────────────────────────────────────
    const tsMs = getTimestamp();                 // e.g. 1655730123456
    const ts   = new Date(tsMs).toISOString();   // "2025-06-20T14:22:03.456Z"
    const now  = DateTime.fromMillis(tsMs).toUTC();

    // ──────────────────────────────────────────────────────────
    // 3) Log the raw event for immutable history
    // ──────────────────────────────────────────────────────────
    const eventItem = {
      userId,
      sortKey: `EVENT#${eventType}#${ts}`,  // unique per event
      type: eventType,
      ts,
      ...(eventType !== "LOGIN" ? { delta } : {}),
      ...(reason ? { reason } : {}),
    };
    await createItemInDynamoDB(
      eventItem,
      TABLE_NAME.USER_ACHIEVEMENTS
    );

    // ──────────────────────────────────────────────────────────
    // 4) Handle eventType-specific logic
    // ──────────────────────────────────────────────────────────
    if (eventType === "LOGIN") {
      // ---- LOGIN: apply 3-day build-up streak logic ----

      // Keys for consecutive-days and streak counters
      const consecKey = { userId, sortKey: "COUNTER#CONSEC_DAYS" };
      const streakKey = { userId, sortKey: "COUNTER#STREAK" };

      // Fetch existing counters
      const [consecRes, streakRes] = await Promise.all([
        getItem(TABLE_NAME.USER_ACHIEVEMENTS, consecKey),
        getItem(TABLE_NAME.USER_ACHIEVEMENTS, streakKey),
      ]);

      // Compute new consecutive-days count
      let consecDays = 1;
      if (consecRes.Item?.lastUpdate) {
        const lastDate  = DateTime.fromISO(consecRes.Item.lastUpdate).toISODate();
        const yesterday = now.minus({ days: 1 }).toISODate();
        if (lastDate === yesterday) {
          consecDays = consecRes.Item.value + 1;
        }
      }

      // Persist updated consecutive-days counter
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: consecKey,
        UpdateExpression: "SET #v = :val, lastUpdate = :now",
        ExpressionAttributeNames: { "#v": "value" },
        ExpressionAttributeValues: { ":val": consecDays, ":now": ts }
      });

      // Every 3 consecutive days → award one streak point
      let newStreak = streakRes.Item?.value || 0;
      if (consecDays % 3 === 0) {
        newStreak += 1;

        // Persist updated streak counter
        await updateItemInDynamoDB({
          table: TABLE_NAME.USER_ACHIEVEMENTS,
          Key: streakKey,
          UpdateExpression: "SET #v = :val, lastUpdate = :now",
          ExpressionAttributeNames: { "#v": "value" },
          ExpressionAttributeValues: { ":val": newStreak, ":now": ts }
        });

        // ---- Schedule “streak about to break” notification ----

        // Compute next UTC midnight, then subtract lead time
        const expiry  = now.endOf("day").plus({ days: 1 });
        const notifyAt = expiry.minus({ seconds: DEFAULT_STREAK_LEAD_TIME_SEC });

        const notifItem = {
          userId,
          sortKey:      "NOTIF#STREAK_EXPIRE",
          nextNotifyAt: notifyAt.toISO(),
          sent:         false
        };

        // Upsert notification marker (no condition needed)
        await createItemInDynamoDB(
          notifItem,
          TABLE_NAME.USER_ACHIEVEMENTS
        );
      }

    } else {
      // ---- GEMS or XP: atomic add to the corresponding counter ----

      const counterKey = { userId, sortKey: `COUNTER#${eventType}` };
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: counterKey,
        UpdateExpression: "ADD #v :delta SET lastUpdate = :now",
        ExpressionAttributeNames: { "#v": "value" },
        ExpressionAttributeValues: { ":delta": delta, ":now": ts }
      });
    }

    // ──────────────────────────────────────────────────────────
    // 5) Fetch updated metrics to return to the client
    // ──────────────────────────────────────────────────────────
    const metrics = await Promise.all(
      ["STREAK","GEMS","XP"].map(metric =>
        getItem(
          TABLE_NAME.USER_ACHIEVEMENTS,
          { userId, sortKey: `COUNTER#${metric}` }
        ).then(res => ({
          metric,
          value:      res.Item?.value      || 0,
          lastUpdate: res.Item?.lastUpdate || null
        }))
      )
    );

    // Return the recorded event and fresh counters
    return sendResponse(
      200,
      `${eventType} event processed successfully`,
      { event: eventItem, metrics }
    );

  } catch (error) {
    console.error("Error processing achievement event:", error);
    return sendResponse(
      500,
      "Internal error processing achievement event",
      error.message || error
    );
  }
};
