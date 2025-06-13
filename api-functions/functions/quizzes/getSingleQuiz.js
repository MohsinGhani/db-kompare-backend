import { sendResponse } from "../../helpers/helpers.js";
import { getItem } from "../../helpers/dynamodb.js"; // Assuming this function fetches a single item
import { getBatchItems } from "../../helpers/dynamodb.js"; // Your custom function to fetch multiple items
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

    const quiz = result.Item;

    // 1. Extract the question IDs from the quiz
    const questionIds = quiz.questionIds || [];
    if (questionIds.length === 0) {
      return sendResponse(404, "No questions found for this quiz", null);
    }

    // 2. Prepare the keys for the batch fetch operation (question IDs)
    const keys = questionIds.map(id => ({ id } ));

    // 3. Fetch questions using BatchGetItem
    const questionsResult = await getBatchItems(TABLE_NAME.QUIZZES_QUESTIONS, keys);

    if (!questionsResult || !questionsResult.Responses || questionsResult.Responses.length === 0) {
      return sendResponse(404, "Questions not found", null);
    }

    // 4. Return the quiz with the questions
    quiz.questions = questionsResult.Responses?.[TABLE_NAME.QUIZZES_QUESTIONS] || [];

    console.log("Fetched quiz:", quiz);
    return sendResponse(200, "Quiz and questions fetched successfully", quiz);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
