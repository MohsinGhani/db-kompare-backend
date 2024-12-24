import { getBatchItems, getItem, sendResponse } from "../../helpers/helpers.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event, context, callback) => {
  try {
    const { ids } = JSON.parse(event.body);

    // Validate IDs
    if (!ids || !Array.isArray(ids)) {
      return sendResponse(400, "An array of database IDs is required", null);
    }

    if (ids.length > 5) {
      return sendResponse(
        400,
        "You can request a maximum of 5 databases at a time.",
        null
      );
    }

    const comments = await getBatchItems(TABLE_NAME.COMMENTS, ids);

    if (!comments || comments.length === 0) {
      return sendResponse(200, "No comments found for the provided IDs", null);
    }

    // Organize comments into parent-reply structure
    const commentMap = new Map();

    // Separate parents and replies
    comments.forEach((comment) => {
      if (!comment.repliedTo) {
        // Parent comment
        commentMap.set(comment.id, { ...comment, replies: [] });
      }
    });

    comments.forEach((comment) => {
      if (comment.repliedTo && commentMap.has(comment.repliedTo)) {
        // Add to replies of the parent
        commentMap.get(comment.repliedTo).replies.push(comment);
      }
    });

    // Add database details for each comment
    const commentPromises = Array.from(commentMap.values()).map(
      async (comment) => {
        const createdByDetails = await getDatabaseDetailsById(
          comment.createdBy
        );
        comment.createdBy = createdByDetails;

        const replyPromises = comment.replies.map(async (reply) => {
          const replyCreatedByDetails = await getDatabaseDetailsById(
            reply.createdBy
          );
          return { ...reply, createdBy: replyCreatedByDetails };
        });

        comment.replies = await Promise.all(replyPromises);
        return comment;
      }
    );

    const result = await Promise.all(commentPromises);

    return sendResponse(200, "Comments details", result);
  } catch (error) {
    console.error("Error fetching comments details:", error);
    return sendResponse(500, "Failed to fetch comments details", error.message);
  }
};

// Get database name
const getDatabaseDetailsById = async (userId) => {
  const key = {
    id: userId,
  };
  try {
    const result = await getItem(TABLE_NAME.USERS, key);
    if (result.Item) {
      return result.Item;
    }

    console.log("🚀 ~ result.Item:", result.Item);

    return "Unknown"; // Fallback if the database name is not found
  } catch (error) {
    console.error(`Error fetching database name for ID ${userId}:`, error);
    throw error;
  }
};
