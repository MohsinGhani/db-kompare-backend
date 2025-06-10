// src/functions/getCategories.js

import { fetchAllItemByDynamodbIndex, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, QUERY_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // 1. Read the `status` query parameter (default to "ACTIVE")
    const status = event.queryStringParameters?.status || QUERY_STATUS.ACTIVE;

    // 2. Validate that `status` is a non-empty string
    if (typeof status !== "string" || status.trim() === "") {
      return sendResponse(
        400,
        "`status` query parameter must be a non-empty string",
        null
      );
    }

    // 3. Fetch all categories with the given status
    const categories = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.CATEGORIES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
    });

    // Create a map for quick lookup and initialize children arrays
    const categoryMap = new Map();
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    });

    // Build the hierarchy
    const rootCategories = [];
    
    categoryMap.forEach(category => {
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    // 4. Return the hierarchical list of categories
    return sendResponse(
      200,
      "Categories fetched successfully",
      rootCategories
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    return sendResponse(
      500,
      "Internal server error while fetching categories",
      error.message || null
    );
  }
};