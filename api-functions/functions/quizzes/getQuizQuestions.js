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

    // 4. If no questions found, return a response indicating no data
    if (!questions || questions.length === 0) {
      return sendResponse(404, "No quiz questions found", null);
    }

    // 5. Collect promises to fetch category details for each question
    const categoryPromises = questions.map(async (question) => {
      if (question.category) {
        const categoryDetails = await getCategoryById(question.category);
        question.category = categoryDetails; // Assign category details to the question
      }
    });

    // 6. Wait for all category details to be fetched concurrently using Promise.all
    await Promise.all(categoryPromises);

    // 7. Return the list of questions with category details
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
