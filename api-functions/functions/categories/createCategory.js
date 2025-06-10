// src/functions/createCategories.js

import { batchWriteItems } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { QUERY_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // 1. Parse the payload as a JSON array
    const categoryArray = JSON.parse(event.body);

    if (!Array.isArray(categoryArray) || categoryArray.length === 0) {
      return sendResponse(
        400,
        "Request body must be a non-empty array of categories",
        null
      );
    }

    const itemsToWrite = [];

    // 2. Iterate over each category payload and build the item
    categoryArray.forEach((raw, idx) => {
      const { name, description = "", parentId = null } = raw ?? {};

      // 2a. Validate required fields
      if (typeof name !== "string" || name.trim() === "") {
        throw new Error(`Item ${idx}: "name" must be a non-empty string`);
      }

      // 2b. Construct the DynamoDB item
      const categoryItem = {
        id: uuidv4(),
        createdAt: getTimestamp(),
        name: name.trim(),
        description,
        status: QUERY_STATUS.ACTIVE,
        parentId,
      };

      // 2c. Collect for batch write and keep for response
      itemsToWrite.push(categoryItem);
    });

    // 3. Batch-write all items (up to 25 per request)
    await batchWriteItems(TABLE_NAME.CATEGORIES, itemsToWrite);

    // 4. Return all created items
    return sendResponse(200, "Categories created successfully", itemsToWrite);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendResponse(400, "Malformed JSON in request body", null);
    }
    if (error.message?.startsWith("Item")) {
      return sendResponse(400, error.message, null);
    }
    console.error("Unexpected error:", error);
    return sendResponse(
      500,
      "Internal server error while creating categories",
      error.message || null
    );
  }
};
