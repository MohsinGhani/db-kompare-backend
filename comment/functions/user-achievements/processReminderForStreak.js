/**
 * streakExpiryNotifier.js
 *
 * Purpose:
 *   - Runs daily via an EventBridge schedule
 *   - Queries DynamoDB for any “streak-expire” notifications due in the next 24 hours
 *   - Sends reminder emails to those users via SES
 *   - Marks each notification as sent to avoid duplicates
 */

import AWS from "aws-sdk";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem, updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

// DynamoDB DocumentClient for querying
const dynamoDb = new AWS.DynamoDB.DocumentClient();
// SES client for sending email
const ses = new AWS.SES({ region: process.env.AWS_REGION });

export const handler = async () => {
  try {
    // 1) Compute current time window: now → now + 24h
    const now = new Date();
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // 2) Query GSI-NextNotify for NOTIF#STREAK_EXPIRE items due in that window & not yet sent
    const queryParams = {
      TableName: TABLE_NAME.USER_ACHIEVEMENTS,
      IndexName: "GSI-NextNotify",
      KeyConditionExpression:
        "sortKey = :notif AND nextNotifyAt BETWEEN :start AND :end",
      FilterExpression: "sent = :false",
      ExpressionAttributeValues: {
        ":notif": "NOTIF#STREAK_EXPIRE",
        ":start": startIso,
        ":end": endIso,
        ":false": false,
      },
    };
    const { Items = [] } = await dynamoDb.query(queryParams).promise();

    // 3) Process each notification
    for (const notif of Items) {
      const { userId } = notif;

      // 3a) Fetch user to get email address
      const userRes = await getItem(TABLE_NAME.USERS, { id: userId });
      const email = userRes.Item?.email;
      if (!email) {
        console.warn(`Skipping user ${userId}: no email on record.`);
        continue;
      }

      // 3b) Fetch current streak count
      const streakRes = await getItem(TABLE_NAME.USER_ACHIEVEMENTS, {
        userId,
        sortKey: "COUNTER#STREAK",
      });
      const streakCount = streakRes.Item?.value || 0;

      // 3c) Send the reminder email
      const emailParams = {
        Source: process.env.SES_SOURCE_EMAIL, // e.g. "no-reply@yourdomain.com"
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: "Your streak is about to expire!" },
          Body: {
            Text: {
              Data: `Hi there,

You’ve earned ${streakCount} streak point${streakCount !== 1 ? "s" : ""}.
Be sure to log in within the next 24 hours to keep your streak going!

Keep it up,
The Team`,
            },
          },
        },
      };
      await ses.sendEmail(emailParams).promise();

      // 3d) Mark the notification as sent
      await updateItemInDynamoDB({
        table: TABLE_NAME.USER_ACHIEVEMENTS,
        Key: { userId, sortKey: "NOTIF#STREAK_EXPIRE" },
        UpdateExpression: "SET sent = :true",
        ExpressionAttributeValues: { ":true": true },
      });
    }

    return sendResponse(200, "Streak reminder emails processed", {
      count: Items.length,
    });
  } catch (error) {
    console.error("Error in streakExpiryNotifier:", error);
    return sendResponse(
      500,
      "Failed to process streak reminders",
      error.message || error
    );
  }
};
