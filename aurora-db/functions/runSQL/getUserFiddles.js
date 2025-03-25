import { TABLE_NAME } from "../../helpers/constants.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Extract the userId from the query string parameters.
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return sendResponse(400, "Missing userId parameter", null);
    }

    // Build the query parameters for the GSI 'byOwnerId'
    const params = {
      TableName: TABLE_NAME.FIDDLES,
      IndexName: "byOwnerId",
      KeyConditionExpression: "ownerId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };

    // Query the DynamoDB table using your helper function
    const fiddles = await fetchAllItemByDynamodbIndex(params);

    return sendResponse(200, "Fiddles fetched successfully", fiddles);
  } catch (error) {
    console.error("Error fetching fiddles by user:", error);
    return sendResponse(500, error, null);
  }
};
