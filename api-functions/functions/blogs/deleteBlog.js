import { deleteItem, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { id, userId, blogId, type } = JSON.parse(event.body);

    // Validate input
    if (!type) {
      return sendResponse(400, "'type' is required.");
    }

    let tableName;
    let key;

    switch (type.toUpperCase()) {
      case "BLOG":
        if (!id) {
          return sendResponse(400, "'id' is required for BLOG.");
        }
        tableName = TABLE_NAME.BLOGS;
        key = { id };
        break;

      case "SAVED_BLOG":
        if (!userId || !blogId) {
          return sendResponse(
            400,
            "'userId' and 'blogId' are required for SAVED_BLOG."
          );
        }
        tableName = TABLE_NAME.SAVED_BLOGS;
        key = { userId, blogId };
        break;

      default:
        return sendResponse(
          400,
          "Invalid 'type' provided. Must be 'BLOG' or 'SAVED_BLOG'."
        );
    }

    // Check if the item exists
    const existingItem = await getItem(tableName, key);

    if (!existingItem || !existingItem.Item) {
      return sendResponse(404, "Item does not exist.");
    }

    // Delete the item
    await deleteItem(tableName, key);

    return sendResponse(200, "Item deleted successfully.");
  } catch (error) {
    console.error("Error deleting item:", error);
    return sendResponse(500, "Internal Server Error", { error: error.message });
  }
};
