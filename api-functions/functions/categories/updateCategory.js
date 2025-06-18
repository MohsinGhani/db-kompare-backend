// src/functions/updateCategory.js

import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { updateItemInDynamoDB, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    // 1. Extract category ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing category ID", null);
    }

    // 2. Fetch existing category to verify it exists
    const existing = await getItem(TABLE_NAME.CATEGORIES, { id });
    if (!existing || !existing.Item) {
      return sendResponse(404, "Category not found", null);
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

    Object.entries(body).forEach(([key, value]) => {
      // Do not allow updating the primary key 'id'
      if (key === "id") return;

      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      updateClauses.push(`${nameKey} = ${valueKey}`);
    });

    if (!updateClauses.length) {
      return sendResponse(400, "No valid fields to update", null);
    }

    const UpdateExpression = `SET ${updateClauses.join(", ")}`;

    // 5. Perform the update
    const updated = await updateItemInDynamoDB({
      table: TABLE_NAME.CATEGORIES,
      Key: { id },
      UpdateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    // 6. Return updated item
    return sendResponse(
      200,
      "Category updated successfully",
      updated.Attributes
    );
  } catch (error) {
    console.error("Error updating category:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
