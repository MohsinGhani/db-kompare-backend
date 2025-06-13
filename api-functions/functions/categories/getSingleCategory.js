import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
      const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, "Missing category ID", null);
    }
    // Fetch the item from DynamoDB
    const result = await getItem(TABLE_NAME.CATEGORIES, { id });

    // If the category is found
    if (result.Item) {
      // Send a success response with the category
      return sendResponse(200, "Category fetched successfully", result.Item);
    } else {
      // If the category is not found, return a not found response
      return sendResponse(404, "Category not found", null);
    }
  } catch (error) {
    console.log("Failed to get category by ID", error.message);
    // Send an internal server error response in case of failure
    return sendResponse(500, "Internal Server Error", null);
  }
};
