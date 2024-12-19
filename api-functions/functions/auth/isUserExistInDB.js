import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event, context, callback) => {
  const { email } = event.queryStringParameters || {};

  if (!email) {
    return sendResponse(400, "email is required", null);
  }
  try {
    const data = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.USERS, // Use the table name constant
      IndexName: "byEmail",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email, // Example: if you want to filter by active status
      },
    });

    // Check if there are any items in the response and return them
    return sendResponse(200, "Successful", data);
  } catch (error) {
    console.error("Error fetching databases:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
