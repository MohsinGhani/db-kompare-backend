// src/functions/getQuizzes.js
import { sendResponse } from "../../helpers/helpers.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, QUERY_STATUS } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // Determine status filter (default to ACTIVE if not specified)
    const status = event.queryStringParameters?.status || QUERY_STATUS.ACTIVE;

    // Fetch quizzes by status using the byStatus GSI
    const quizzes = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUIZZES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
    });

    return sendResponse(200, "Quizzes fetched successfully", quizzes);
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return sendResponse(500, "Error fetching quizzes", error.message);
  }
};
