// src/functions/updateQuizProgress.js

import { sendResponse } from "../../helpers/helpers.js";
import { getItem, updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // 1. Parse body
    const body = JSON.parse(event.body || "{}");
    const { userId, quizId, ...fields } = body;

    if (!userId || !quizId) {
      return sendResponse(400, "Missing userId or quizId", null);
    }

    // 2. Verify existing progress row
    const existing = await getItem(TABLE_NAME.QUIZ_PROGRESS, { userId, quizId });
    if (!existing || !existing.Item) {
      return sendResponse(404, "Progress not found", null);
    }

    // 3. Build dynamic UpdateExpression
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    const updateClauses = [];

    for (let [key, value] of Object.entries(fields)) {
    

      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      updateClauses.push(`${nameKey} = ${valueKey}`);
    }

    if (!updateClauses.length) {
      return sendResponse(400, "No valid fields to update", null);
    }

    const UpdateExpression = `SET ${updateClauses.join(", ")}`;

    // 4. Perform update
    const updated = await updateItemInDynamoDB({
      table: TABLE_NAME.QUIZ_PROGRESS,
      Key: { userId, quizId },
      UpdateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    // 5. Return the new attributes
    return sendResponse(
      200,
      "Quiz progress updated successfully",
      updated.Attributes
    );
  } catch (error) {
    console.error("Error updating quiz progress:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
