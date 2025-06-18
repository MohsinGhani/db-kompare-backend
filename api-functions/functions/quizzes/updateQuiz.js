// src/functions/updateQuiz.js
import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { updateItemInDynamoDB, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);

    // Extract quiz ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing quiz ID", null);
    }

    // Fetch existing quiz to verify it exists
    const existing = await getItem(TABLE_NAME.QUIZZES, { id });
    if (!existing || !existing.Item) {
      return sendResponse(404, "Quiz not found", null);
    }

    // Parse update payload
    const body = JSON.parse(event.body || "{}");
    if (!Object.keys(body).length) {
      return sendResponse(400, "No update data provided", null);
    }

    // Build dynamic UpdateExpression
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    const updateClauses = [];

    Object.entries(body).forEach(([key, value]) => {
      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      updateClauses.push(`${nameKey} = ${valueKey}`);
    });

    const UpdateExpression = `set ${updateClauses.join(", ")}`;

    // Perform the update
    const updated = await updateItemInDynamoDB({
      table: TABLE_NAME.QUIZZES,
      Key: { id },
      UpdateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    return sendResponse(
      200,
      "Quiz updated successfully",
      updated.Attributes || updated
    );
  } catch (error) {
    console.error("Error updating quiz:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
