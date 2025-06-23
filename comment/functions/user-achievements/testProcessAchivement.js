//------------------------------------------------------------
// THIS IS A TEST FILE, DO NOT DEPLOY IT!

// This file is used to test the processAchievement function locally.
// -----------------------------------------------------------



import { TABLE_NAME } from "../../helpers/constants.js";
import {
  createItemInDynamoDB,
  updateItemInDynamoDB,
  getItem,
} from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";
import { DateTime } from "luxon";

// Configuration: easily tweak these values
// Set BUILD_UP_DAYS to 1 for daily streaks, 3 for every 3rd day, etc.
const BUILD_UP_DAYS       = 3;               // days to earn one streak point
const REMINDER_DELAY_DAYS = 3;               // days of inactivity before sending reminder
const BREAK_AFTER_DAYS    = 1;               // days after reminder before breaking streak
const NOTIF_LEAD_TIME_SEC = 3 * 60 * 60;     // lead time (in seconds) before notifications


const payloadExample = {
  userId: "user123",
    eventType: "LOGIN", // or "GEMS", "XP"
    delta: 100, // required for GEMS/XP, ignored for LOGIN
    reason: "Daily login", // optional, for additional context
    overrideNow: "2023-10-01T12:00:00Z" // optional, ISO timestamp to simulate "now" for testing
};

export const handler = async (event) => {
  try {
    // 1) Parse & validate input (including optional overrideNow for testing)
    const {
      userId,
      eventType,
      delta,
      reason,
      overrideNow      // ISO timestamp string to simulate "now"
    } = JSON.parse(event.body || "{}");

    if (!userId || !["LOGIN", "GEMS", "XP"].includes(eventType)) {
      return sendResponse(400, "Missing or invalid fields: userId, eventType must be LOGIN | GEMS | XP");
    }
    if ((eventType === "GEMS" || eventType === "XP") &&
        (typeof delta !== "number" || delta <= 0)) {
      return sendResponse(400, "For GEMS/XP events, delta must be a positive number");
    }

    // 2) Determine timestamp (allow override for static testing)
    const tsMs = overrideNow
      ? DateTime.fromISO(overrideNow).toMillis()
      : getTimestamp();
    const ts   = new Date(tsMs).toISOString();
    const now  = DateTime.fromMillis(tsMs).toUTC();

    // 3) Log the raw event for immutable history
    const eventItem = {
      userId,
      sortKey: `EVENT#${eventType}#${ts}`,
      type: eventType,
      ts,
      ...(eventType !== "LOGIN" ? { delta } : {}),
      ...(reason ? { reason } : {}),
    };
    await createItemInDynamoDB(eventItem, TABLE_NAME.USER_ACHIEVEMENTS);

    // 4) Handle eventType-specific logic
    if (eventType === "LOGIN") {
      // ---- LOGIN: handle consecutive-days & streak logic ----
      const consecKey = { userId, sortKey: "COUNTER#CONSEC_DAYS" };

      // Fetch existing consecutive-days counter
      const consecRes = await getItem(TABLE_NAME.USER_ACHIEVEMENTS, consecKey);
      const lastTsIso = consecRes.Item?.lastUpdate || null;
      const lastDate  = lastTsIso ? DateTime.fromISO(lastTsIso).toISODate() : null;
      const todayDate = now.toISODate();

      // Calculate days since last login (integer days)
      const daysSince = lastDate
        ? Math.floor(
            now
              .startOf("day")
              .diff(DateTime.fromISO(lastDate).startOf("day"), "days").days
          )
        : null;

      // Compute new consecutive-days value
      let consecDays;
      if (lastDate === todayDate) {
        // already logged in today → no change
        consecDays = consecRes.Item?.value || 0;
      } else if (daysSince === 1) {
        // perfect next-day login → increment
        consecDays = (consecRes.Item?.value || 0) + 1;
      } else {
        // first login ever or streak broken → reset to 1
        consecDays = 1;
      }

      // Persist consecutive-days counter
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: consecKey,
        UpdateExpression: "SET #v = :val, lastUpdate = :now",
        ExpressionAttributeNames: { "#v": "value" },
        ExpressionAttributeValues: { ":val": consecDays, ":now": ts },
      });

      // Award a streak point on every multiple of BUILD_UP_DAYS
      if (consecDays % BUILD_UP_DAYS === 0 && daysSince === 1) {
        const streakKey = { userId, sortKey: "COUNTER#STREAK" };
        const streakRes = await getItem(TABLE_NAME.USER_ACHIEVEMENTS, streakKey);
        const newStreak = (streakRes.Item?.value || 0) + 1;

        await updateItemInDynamoDB({
          table: TABLE_NAME.USER_ACHIEVEMENTS,
          Key: streakKey,
          UpdateExpression: "SET #v = :val, lastUpdate = :now",
          ExpressionAttributeNames: { "#v": "value" },
          ExpressionAttributeValues: { ":val": newStreak, ":now": ts },
        });
      }

      // Schedule reminder and break notifications (upsert every login)
      const reminderAt = now
        .plus({ days: REMINDER_DELAY_DAYS })
        .minus({ seconds: NOTIF_LEAD_TIME_SEC });
      const breakAt = now
        .plus({ days: REMINDER_DELAY_DAYS + BREAK_AFTER_DAYS })
        .minus({ seconds: NOTIF_LEAD_TIME_SEC });

      for (const [type, dt] of [
        ["REMIND", reminderAt],
        ["BREAK",  breakAt],
      ]) {
        await createItemInDynamoDB(
          {
            userId,
            sortKey: `NOTIF#STREAK_${type}`,
            nextNotifyAt: dt.toISO(),
            sent: false,
          },
          TABLE_NAME.USER_ACHIEVEMENTS
        );
      }
    } else {
      // ---- GEMS/XP: atomic add to counters ----
      const counterKey = { userId, sortKey: `COUNTER#${eventType}` };
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: counterKey,
        UpdateExpression: "ADD #v :delta SET lastUpdate = :now",
        ExpressionAttributeNames: { "#v": "value" },
        ExpressionAttributeValues: { ":delta": delta, ":now": ts },
      });
    }

    // // 5) Fetch updated metrics to return
    // const metrics = await Promise.all(
    //   ["STREAK", "GEMS", "XP"].map((metric) =>
    //     getItem(TABLE_NAME.USER_ACHIEVEMENTS, { userId, sortKey: `COUNTER#${metric}` })
    //       .then((res) => ({
    //         metric,
    //         value: res.Item?.value || 0,
    //         lastUpdate: res.Item?.lastUpdate || null,
    //       }))
    //   )
    // );

    return sendResponse(200, `${eventType} event processed successfully`, {
      event: eventItem,
      // metrics,
    });
  } catch (error) {
    console.error("Error processing achievement event:", error);
    return sendResponse(500, "Internal error processing achievement event", error.message || error);
  }
};
