import { deleteItem, getItem, getItemByIndex } from "../../helpers/dynamodb.js";
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

    let deletedCount = 0;

    // If deleting a blog, also delete its associated saved blogs
    if (type.toUpperCase() === "BLOG") {
      // Query and delete associated saved blogs using the helper
      const savedBlogs = await getItemByIndex(
        TABLE_NAME.SAVED_BLOGS,
        "BlogIdIndex", // Use the GSI
        "blogId = :blogId",
        null, // No attribute names required
        { ":blogId": id } // Expression attribute values
      );

      if (savedBlogs && savedBlogs.Items && savedBlogs.Items.length > 0) {
        deletedCount = savedBlogs.Items.length; // Count how many entries will be deleted
        const deletePromises = savedBlogs.Items.map((savedBlog) => {
          const savedBlogKey = {
            userId: savedBlog.userId,
            blogId: savedBlog.blogId,
          };
          return deleteItem(TABLE_NAME.SAVED_BLOGS, savedBlogKey);
        });
        await Promise.all(deletePromises);
      }
    }

    // Delete the main item
    await deleteItem(tableName, key);

    return sendResponse(
      200,
      `Item deleted successfully. ${deletedCount} saved entries were also removed.`
    );
  } catch (error) {
    console.error("Error deleting item:", error);
    return sendResponse(500, "Internal Server Error", { error: error.message });
  }
};
