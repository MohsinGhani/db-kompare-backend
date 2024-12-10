import { v4 as uuidv4 } from "uuid";
import DynamoDB from "aws-sdk/clients/dynamodb.js";
const DynamoDBClient = new DynamoDB.DocumentClient();

import { createItemInDynamoDB, sendResponse } from "../../helpers/helpers.js";
import { STATUS, TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event, context, callback) => {
  let params = JSON.parse(event.body);

  params.id = uuidv4();
  params.createdAt = new Date().toISOString();
  params.updatedAt = new Date().toISOString();
  params.status = STATUS.ACTIVE;

  // If it's a reply, fetch the parent comment to inherit the databaseId
  if (params.repliedTo) {
    const parentCommentParams = {
      TableName: TABLE_NAME.COMMENTS,
      Key: {
        id: params.repliedTo,
      },
    };

    const parentCommentResult = await DynamoDBClient.get(
      parentCommentParams
    ).promise();

    if (!parentCommentResult.Item) {
      return sendResponse(404, "Parent comment not found", null);
    }

    // Inherit the databaseId from the parent comment
    params.databaseId = parentCommentResult.Item.databaseId;
  }

  if (!params.repliedTo) {
    delete params.repliedTo;
  }

  try {
    await createItemInDynamoDB(
      params,
      TABLE_NAME.COMMENTS,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );
    return sendResponse(200, "Comment Created Successfully", true);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
