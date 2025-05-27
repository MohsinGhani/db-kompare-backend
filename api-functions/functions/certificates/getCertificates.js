// src/functions/getUserCertificates.js
import { sendResponse } from "../../helpers/helpers.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
   const qs = event.queryStringParameters || {};
  const userId = qs.userId;
  
    if (!userId) {
      return sendResponse(400, "Missing User ID", null);
    }

    // Fetch certificates by user using the byUser GSI
    const certificates = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.CERTIFICATES,
      IndexName: "byUser",
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: { "#userId": "userId" },
      ExpressionAttributeValues: { ":userId": userId },
    });

    return sendResponse(200, "User certificates fetched successfully", certificates);
  } catch (error) {
    console.error("Error fetching user certificates:", error);
    return sendResponse(500, "Error fetching user certificates", error.message);
  }
};
