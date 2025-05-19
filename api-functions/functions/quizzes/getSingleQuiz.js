// src/functions/getQuiz.js
import { sendResponse } from "../../helpers/helpers.js";
import { getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // Extract quiz ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing quiz ID", null);
    }

    // Fetch the quiz by ID
    const result = await getItem(TABLE_NAME.QUIZZES, { id });
    if (!result || !result.Item) {
      return sendResponse(404, "Quiz not found", null);
    }

    // Return the quiz item
    return sendResponse(200, "Quiz fetched successfully", result.Item);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
