/**
 * streakExpiryNotifier.js
 *
 * Purpose:
 *   - Runs daily via EventBridge schedule
 *   - Queries DynamoDB for any "streak remind" and "streak break" notifications due in the next 24 hours
 *   - Sends reminder emails via SES
 *   - Resets streak counters for break notifications
 *   - Marks each notification as sent to avoid duplicates
 *
 * Uses the shared DynamoDB helper `fetchAllItemByDynamodbIndex` for paging
 */

import AWS from "aws-sdk";
import { TABLE_NAME } from "../../helpers/constants.js";
import {
  getItem,
  updateItemInDynamoDB,
  fetchAllItemByDynamodbIndex,
} from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

// SES client for sending emails
const ses = new AWS.SES({ region: "eu-west-1" }); // Adjust region as needed

export const handler = async () => {
  try {
    // 1) Compute window: now → next 24h
    const nowIso = new Date().toISOString();
    const endIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
console.log(`Streak expiry notifier running from ${nowIso} to ${endIso}`);
    // 2) Fetch reminder notifications due
    const reminders = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.USER_ACHIEVEMENTS,
      IndexName: "ByNextNotify",
      KeyConditionExpression: "sortKey = :notif AND nextNotifyAt BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":notif": "NOTIF#STREAK_REMIND",
        ":start": nowIso,
        ":end": endIso,
        ":false": false,
      },
      FilterExpression: "sent = :false",
    });
console.log(`Found ${reminders.length} reminders due for processing`);
    // 3) Process reminders: send email & mark sent
    for (const { userId } of reminders) {
      // a) Lookup user email
      const userRes = await getItem(TABLE_NAME.USERS, { id: userId });
      const email = userRes.Item?.email;
      if (!email) continue;

      // b) Get current streak count
      const streakRes = await getItem(TABLE_NAME.USER_ACHIEVEMENTS, { userId, sortKey: "COUNTER#STREAK" });
      const streakCount = streakRes.Item?.value || 0;

      // c) Send reminder email
      await ses.sendEmail({
        Source: "info@dbkompare.com",
        // Source: process.env.SES_SOURCE_EMAIL,
        Destination: { ToAddresses: ["sameerateeq0@gmail.com"] },
        // Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: "Your streak is about to expire!" },
          Body: {
            Text: {
              Data: `Hi,

You have ${streakCount} streak point${streakCount !== 1 ? "s" : ""}.\n` +
                    "Log in within 24 hours to keep your streak going!",
            },
          },
        },
      }).promise();

      // d) Mark reminder as sent
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: { userId, sortKey: "NOTIF#STREAK_REMIND" },
        UpdateExpression: "SET sent = :true",
        ExpressionAttributeValues: { ":true": true },
      });
    }

    // 4) Fetch break notifications due
    const breaks = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.USER_ACHIEVEMENTS,
      IndexName: "ByNextNotify",
      KeyConditionExpression: "sortKey = :notif AND nextNotifyAt BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":notif": "NOTIF#STREAK_BREAK",
        ":start": nowIso,
        ":end": endIso,
        ":false": false,
      },
      FilterExpression: "sent = :false",
    });

    // 5) Process breaks: reset streak & consec-days, then mark sent
    for (const { userId } of breaks) {
      // a) Reset consecutive-days counter
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: { userId, sortKey: "COUNTER#CONSEC_DAYS" },
        UpdateExpression: "SET #v = :zero, lastUpdate = :now",
        ExpressionAttributeNames: { "#v": "value" },
        ExpressionAttributeValues: { ":zero": 0, ":now": nowIso },
      });
      // b) Reset streak counter
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: { userId, sortKey: "COUNTER#STREAK" },
        UpdateExpression: "SET #v = :zero, lastUpdate = :now",
        ExpressionAttributeNames: { "#v": "value" },
        ExpressionAttributeValues: { ":zero": 0, ":now": nowIso },
      });
      // c) Mark break notification as sent
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: { userId, sortKey: "NOTIF#STREAK_BREAK" },
        UpdateExpression: "SET sent = :true",
        ExpressionAttributeValues: { ":true": true },
      });
    }

    // 6) Return summary
    return sendResponse(200, "Streak notifications processed", {
      reminders: reminders.length,
      breaks: breaks.length,
    });
  } catch (error) {
    console.error("Error in streakExpiryNotifier:", error);
    return sendResponse(500, "Failed to process streak notifications", error.message || error);
  }
};
