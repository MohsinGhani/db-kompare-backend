import { getBatchItems, sendResponse } from "../../helpers/helpers.js";
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
      return sendResponse(404, "No comments found for the provided IDs", null);
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

    // Get the structured data
    const result = Array.from(commentMap.values());

    return sendResponse(200, "Comments details", result);
  } catch (error) {
    console.error("Error fetching comments details:", error);
    return sendResponse(500, "Failed to fetch comments details", error.message);
  }
};
