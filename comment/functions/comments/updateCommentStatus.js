import { sendResponse } from "../../helpers/helpers.js";
import { STATUS, TABLE_NAME } from "../../helpers/constants.js";
import DynamoDB from "aws-sdk/clients/dynamodb.js";
const DynamoDBClient = new DynamoDB.DocumentClient();

export const handler = async (event, context, callback) => {
  try {
    const { id, status } = JSON.parse(event.body);

    if (!id) {
      return sendResponse(400, "Bad Request: Missing comment ID", false);
    }

    // Fetch the comment
    const params = {
      TableName: TABLE_NAME.COMMENTS,
      Key: {
        id,
      },
    };

    const commentResult = await DynamoDBClient.get(params).promise();

    if (!commentResult.Item) {
      return sendResponse(404, "Comment not found", null);
    }

    const comment = commentResult.Item;

    // If it's a parent comment and the status is being changed
    if (
      !comment.repliedTo &&
      (status === STATUS.DISABLED || status === STATUS.ACTIVE)
    ) {
      // Query for replies
      const replyParams = {
        TableName: TABLE_NAME.COMMENTS,
        IndexName: "byRepliedTo",
        KeyConditionExpression: "repliedTo = :repliedTo",
        ExpressionAttributeValues: {
          ":repliedTo": id,
        },
      };

      const repliesResult = await DynamoDBClient.query(replyParams).promise();
      const replies = repliesResult.Items;

      // Update parent comment
      const updateParentParams = {
        TableName: TABLE_NAME.COMMENTS,
        Key: { id },
        UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(#status)",
      };

      await DynamoDBClient.update(updateParentParams).promise();

      // Update each reply individually
      for (const reply of replies) {
        const updateReplyParams = {
          TableName: TABLE_NAME.COMMENTS,
          Key: { id: reply.id },
          UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#status": "status",
            "#updatedAt": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":status": status,
            ":updatedAt": new Date().toISOString(),
          },
          ConditionExpression: "attribute_exists(#status)",
        };

        await DynamoDBClient.update(updateReplyParams).promise();
      }

      const action = status === STATUS.ACTIVE ? "enabled" : "disabled";
      return sendResponse(
        200,
        `Parent comment and its replies ${action} successfully`,
        true
      );
    } else {
      // Update a single comment or reply
      const updateParams = {
        TableName: TABLE_NAME.COMMENTS,
        Key: { id },
        UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(#status)",
      };

      await DynamoDBClient.update(updateParams).promise();

      return sendResponse(200, "Comment updated successfully", true);
    }
  } catch (error) {
    console.error("Error updating comment status:", error);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
