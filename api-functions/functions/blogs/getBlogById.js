import { getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing blog ID", false);
    }

    const blogItem = await getItem(TABLE_NAME.BLOGS, { id });

    if (!blogItem || !blogItem.Item) {
      return sendResponse(404, "Blog not found", false);
    }

    return sendResponse(200, "Blog retrieved successfully", blogItem.Item);
  } catch (error) {
    return sendResponse(500, "Error retrieving blog:", error.message);
  }
};
