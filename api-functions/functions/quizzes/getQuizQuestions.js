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
import { getCategoryById } from "../common/categories.js";

export const handler = async (event) => {
  try {
    // 1. Read query parameters, defaulting status to ACTIVE
    const {
      status = QUERY_STATUS.ACTIVE,
      category
    } = event.queryStringParameters || {};

    // 2. Validate status
    if (typeof status !== "string" || !status.trim()) {
      return sendResponse(400, "`status` must be a non-empty string", null);
    }

    // 3. If category is provided, validate it
    if (category != null && (typeof category !== "string" || !category.trim())) {
      return sendResponse(400, "`category` must be a non-empty string", null);
    }

    // 4. Build the Dynamo query input
    let queryInput;
    if (category) {
      // Query by category GSI
      queryInput = {
        TableName: TABLE_NAME.QUIZZES_QUESTIONS,
        IndexName: "byCategory",
        KeyConditionExpression: "#category = :category",
        ExpressionAttributeNames: { "#category": "category" },
        ExpressionAttributeValues: { ":category": category }
      };
      // If status provided as well, filter on status
      if (status) {
        queryInput.FilterExpression = "#status = :status";
        queryInput.ExpressionAttributeNames["#status"] = "status";
        queryInput.ExpressionAttributeValues[":status"] = status;
      }
    } else {
      // Fallback: query by status GSI
      queryInput = {
        TableName: TABLE_NAME.QUIZZES_QUESTIONS,
        IndexName: "byStatus",
        KeyConditionExpression: "#status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": status }
      };
    }

    // 5. Execute the query
    const questions = await fetchAllItemByDynamodbIndex(queryInput);

    // 6. Handle no results
    if (!questions || questions.length === 0) {
      return sendResponse(200, "No quiz questions found for the given criteria", []);
    }

    // 7. Enrich with full category details
    await Promise.all(
      questions.map(async (q) => {
        if (q.category) {
          const details = await getCategoryById(q.category);
          q.category = details;
        }
      })
    );

    // 8. Return
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
