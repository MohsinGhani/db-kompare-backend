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
    if (blogItem.Item.createdBy) {
      blogItem.Item.createdBy = await getUserById(blogItem.Item.createdBy);
    }

    return sendResponse(200, "Blog retrieved successfully", blogItem.Item);
  } catch (error) {
    return sendResponse(500, "Error retrieving blog:", error.message);
  }
};

// Get user
const getUserById = async (userId) => {
  const key = {
    id: userId,
  };
  try {
    const result = await getItem(TABLE_NAME.USERS, key);
    if (result.Item) {
      return result.Item;
    }

    console.log("🚀 ~ result.Item:", result.Item);

    return "ANONYMOUS"; // Fallback if the database name is not found
  } catch (error) {
    console.error(`Error fetching database name for ID ${userId}:`, error);
    throw error;
  }
};
