// src/functions/deleteCategory.js

import { sendResponse } from "../../helpers/helpers.js";
import { deleteItem, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // 1. Extract category ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing category ID", null);
    }

    // 2. Verify category exists
    const existing = await getItem(TABLE_NAME.CATEGORIES, { id });
    
    if (!existing || !existing.Item) {
      return sendResponse(404, "Category not found", null);
    }

    // 3. Delete the category record
    const deleted = await deleteItem(
      TABLE_NAME.CATEGORIES,
      { id },
      { "#id": "id" },
      "attribute_exists(#id)"
    );

    if (!deleted.Attributes) {
      return sendResponse(404, "Category not found or already deleted", null);
    }

    // 4. Return success with deleted attributes
    return sendResponse(
      200,
      "Category deleted successfully",
      deleted.Attributes
    );
  } catch (error) {
    console.error("Error deleting category:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
