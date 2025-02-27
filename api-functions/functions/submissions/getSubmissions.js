// src/functions/getSubmissions.js
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Expecting query string parameters: questionId, optional userId, and optional type ("self" or "others")
    const { questionId, userId, type } = event.queryStringParameters || {};

    if (!questionId) {
      return sendResponse(
        400,
        "Missing required query parameter: questionId",
        null
      );
    }

    // Base parameters: query the byQuestionId GSI for a given questionId.
    const params = {
      TableName: TABLE_NAME.SUBMISSIONS,
      IndexName: "byQuestionId",
      KeyConditionExpression: "questionId = :questionId",
      ExpressionAttributeValues: {
        ":questionId": questionId,
      },
    };

    // If userId and type are provided, add a filter expression.
    // "self" returns submissions only from that user.
    // "others" returns submissions not from that user.
    if (userId && type) {
      if (type === "self") {
        params.FilterExpression = "userId = :userId";
      } else if (type === "others") {
        params.FilterExpression = "userId <> :userId";
      } else {
        return sendResponse(
          400,
          "Invalid type provided. Expected 'self' or 'others'.",
          null
        );
      }
      // Merge userId into ExpressionAttributeValues.
      params.ExpressionAttributeValues[":userId"] = userId;
    }

    const submissions = await fetchAllItemByDynamodbIndex(params);

    return sendResponse(200, "Submissions fetched successfully", submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return sendResponse(500, "Error fetching submissions", error.message);
  }
};
