import { v4 as uuidv4 } from "uuid";
import DynamoDB from "aws-sdk/clients/dynamodb.js";
const DynamoDBClient = new DynamoDB.DocumentClient();

import {
  createItemInDynamoDB,
  getBatchItems,
  sendResponse,
} from "../../helpers/helpers.js";
import { STATUS, TABLE_NAME } from "../../helpers/constants.js";

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

    // Organize comments into parent-reply structure categorized by databaseId
    const databaseMap = new Map();

    comments.forEach((comment) => {
      if (!databaseMap.has(comment.databaseId)) {
        databaseMap.set(comment.databaseId, []);
      }
      databaseMap.get(comment.databaseId).push(comment);
    });

    const result = [];

    // Process each databaseId group
    databaseMap.forEach((commentsGroup, databaseId) => {
      const commentMap = new Map();

      // Separate parents and replies
      commentsGroup.forEach((comment) => {
        if (!comment.repliedTo) {
          // Parent comment
          commentMap.set(comment.id, { ...comment, replies: [] });
        }
      });

      commentsGroup.forEach((comment) => {
        if (comment.repliedTo && commentMap.has(comment.repliedTo)) {
          // Add to replies of the parent
          commentMap.get(comment.repliedTo).replies.push(comment);
        }
      });

      // Get the structured data for the database
      const structuredComments = Array.from(commentMap.values());

      let totalCommentRating = 0;

      structuredComments.forEach((parentComment) => {
        let parentRatingSum = 0;
        let replyCount = parentComment.replies.length;

        // Add weighted parent rating
        parentRatingSum += parentComment.rating * 5;

        // Add ratings of replies
        parentComment.replies.forEach((reply) => {
          parentRatingSum += reply.rating;
        });

        // Calculate adjusted rating for this comment and its replies
        const adjustedRating =
          Math.round((parentRatingSum / (5 + replyCount)) * 100) / 100;

        // Attach adjusted rating to the parent comment
        parentComment.commentRating = adjustedRating;

        totalCommentRating += adjustedRating;
      });

      // Calculate overall database rating
      const databaseRating =
        Math.round((totalCommentRating / structuredComments.length) * 100) /
        100;

      result.push({
        databaseId,
        comments: structuredComments,
        databaseRating,
      });
    });

    return sendResponse(200, "Comment Processed Successfully", result);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
