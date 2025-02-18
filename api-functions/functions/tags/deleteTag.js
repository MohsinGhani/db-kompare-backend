import { sendResponse } from "../../helpers/helpers.js";
import { deleteItem, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // Get tag ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing tag ID", null);
    }

    // Check if the tag exists
    const existingTag = await getItem(TABLE_NAME.TAGS, { id });
    if (!existingTag || !existingTag.Item) {
      return sendResponse(404, "Tag not found", null);
    }

    // Delete the tag from DynamoDB
    const deletedTag = await deleteItem(TABLE_NAME.TAGS, { id });

    return sendResponse(200, "Tag deleted successfully", deletedTag.Attributes);
  } catch (error) {
    console.error("Error deleting tag:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
