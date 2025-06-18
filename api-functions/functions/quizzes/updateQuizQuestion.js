// src/functions/updateQuizQuestion.js

import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { updateItemInDynamoDB, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";
import { getCategoryIdByName } from "../common/categories.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    // 1. Extract question ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

    // 2. Fetch existing question to verify it exists
    const existing = await getItem(TABLE_NAME.QUIZZES_QUESTIONS, { id });
    if (!existing || !existing.Item) {
      return sendResponse(404, "Question not found", null);
    }

    // 3. Parse update payload
    const body = JSON.parse(event.body || "{}");
    if (!body || !Object.keys(body).length) {
      return sendResponse(400, "No update data provided", null);
    }

    // 4. Build dynamic UpdateExpression
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    const updateClauses = [];

    for (let [key, value] of Object.entries(body)) {
      // Do not allow updating the primary key 'id'
      if (key === "id") continue;

      if (key === "category") {
        // Fetch category ID by name and update the 'category' field with the ID
        const categoryId = await getCategoryIdByName(value);
        // Set category ID instead of category name
        value = categoryId;
      }

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

    // 5. Perform the update
    const updated = await updateItemInDynamoDB({
      table: TABLE_NAME.QUIZZES_QUESTIONS,
      Key: { id },
      UpdateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    // 6. Return updated item
    return sendResponse(
      200,
      "Quiz question updated successfully",
      updated.Attributes
    );
  } catch (error) {
    console.error("Error updating quiz question:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
