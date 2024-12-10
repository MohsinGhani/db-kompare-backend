import DynamoDB from "aws-sdk/clients/dynamodb.js";
const DynamoDBClient = new DynamoDB.DocumentClient();

import { sendResponse } from "../../helpers/helpers.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event, context, callback) => {
  try {
    const { commentId } = JSON.parse(event.body);

    if (!commentId) {
      return sendResponse(400, "A valid comment ID is required", null);
    }

    const params = {
      TableName: TABLE_NAME.COMMENTS,
      Key: {
        id: commentId,
      },
    };

    const commentResult = await DynamoDBClient.get(params).promise();

    if (!commentResult.Item) {
      return sendResponse(404, "Comment not found", null);
    }

    const comment = commentResult.Item;

    // If it's a parent comment, find all replies
    if (!comment.repliedTo) {
      // Query for replies
      const replyParams = {
        TableName: TABLE_NAME.COMMENTS,
        IndexName: "byRepliedTo",
        KeyConditionExpression: "repliedTo = :repliedTo",
        ExpressionAttributeValues: {
          ":repliedTo": commentId,
        },
      };

      const repliesResult = await DynamoDBClient.query(replyParams).promise();
      const replies = repliesResult.Items;

      // Delete parent and all replies in batch
      const deleteRequests = [
        { DeleteRequest: { Key: { id: commentId } } }, // Parent comment
        ...replies.map((reply) => ({
          DeleteRequest: { Key: { id: reply.id } },
        })),
      ];

      const batchWriteParams = {
        RequestItems: {
          [TABLE_NAME.COMMENTS]: deleteRequests,
        },
      };

      await DynamoDBClient.batchWrite(batchWriteParams).promise();

      return sendResponse(200, "Comment deleted successfully", null);
    } else {
      // Delete single reply comment
      const deleteParams = {
        TableName: TABLE_NAME.COMMENTS,
        Key: {
          id: commentId,
        },
      };

      await DynamoDBClient.delete(deleteParams).promise();

      return sendResponse(200, "Comment deleted successfully", null);
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    return sendResponse(500, "Failed to delete comment", error.message);
  }
};
