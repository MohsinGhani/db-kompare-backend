
import {
  fetchAllItemByDynamodbIndex
} from "../../helpers/dynamodb.js";
import {
  TABLE_NAME,
  QUERY_STATUS
} from "../../helpers/constants.js";
import {
  sendResponse
} from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // 1. Read the `status` query parameter (default to "ACTIVE")
    const status =
      event.queryStringParameters?.status || QUERY_STATUS.ACTIVE;

    // 2. Validate that `status` is a non-empty string
    if (typeof status !== "string" || status.trim() === "") {
      return sendResponse(400, "`status` query parameter must be a non-empty string", null);
    }

    // 3. Fetch all quiz questions with the given status via the GSI "byStatus"
    const questions = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUIZZES_QUESTIONS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
      },
    });

    // 4. Return the list of questions
    return sendResponse(200, "Quiz questions fetched successfully", questions);
  } catch (error) {
    console.error("Error fetching quiz questions:", error);
    return sendResponse(
      500,
      "Internal server error while fetching quiz questions",
      error.message || null
    );
  }
};
