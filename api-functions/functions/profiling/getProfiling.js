import { TABLE_NAME } from "../../helpers/constants.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

// Initialize DynamoDB DocumentClient

// Environment variables
const TABLE = TABLE_NAME.PROFILING;
const USER_INDEX = process.env.USER_INDEX || "byUser";
const FIDDLE_INDEX = process.env.FIDDLE_INDEX || "byFiddle";

/**
 * Lambda handler to fetch profiling records by userId and/or fiddleId.
 * Uses helper fetchAllItemByDynamodbIndex for pagination and sendResponse for uniform output.
 */
export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const userId = qs.userId;
  const fiddleId = qs.fiddleId;

  if (!userId && !fiddleId) {
    return sendResponse(
      400,
      "Missing userId or fiddleId in query parameters",
      null
    );
  }

  try {
    let items = [];

    if (userId && fiddleId) {
      // Query by userId, then filter by fiddleId
      const userItems = await fetchAllItemByDynamodbIndex({
        TableName: TABLE,
        IndexName: USER_INDEX,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      });
      items = userItems.filter((item) => item.fiddleId === fiddleId);
    } else if (userId) {
      // Query by userId
      items = await fetchAllItemByDynamodbIndex({
        TableName: TABLE,
        IndexName: USER_INDEX,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      });
    } else {
      // Query by fiddleId
      items = await fetchAllItemByDynamodbIndex({
        TableName: TABLE,
        IndexName: FIDDLE_INDEX,
        KeyConditionExpression: "fiddleId = :f",
        ExpressionAttributeValues: { ":f": fiddleId },
      });
    }

    return sendResponse(200, "Items fetched successfully", items);
  } catch (error) {
    console.error("Error querying DynamoDB:", error);
    return sendResponse(500, "Internal server error", null);
  }
};
