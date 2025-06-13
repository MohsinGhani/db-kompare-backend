import { TABLE_NAME } from "../../helpers/constants.js";
import { getBatchItems, getItem } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";  // Assuming sendResponse is defined in helpers.js

export const fetchQuizWithQuestions = async (quizId) => {
  try {
    // 1. Fetch quiz data from the database
    const quizResult = await getItem(TABLE_NAME.QUIZZES, { id: quizId });
    if (!quizResult?.Item) {
      return sendResponse(404, "Quiz not found", null);
    }

    const quiz = quizResult.Item;

    // 2. Extract the question IDs from the quiz
    const questionIds = quiz.questionIds || [];
    if (questionIds.length === 0) {
      return sendResponse(404, "No questions found for this quiz", null);
    }

    // 3. Prepare the keys for batch fetching questions
    const keys = questionIds.map((id) => ({ id }));

    // 4. Fetch questions using BatchGetItem
    const questionsResult = await getBatchItems(TABLE_NAME.QUIZZES_QUESTIONS, keys);

    if (!questionsResult?.Responses?.[TABLE_NAME.QUIZZES_QUESTIONS]?.length) {
      return sendResponse(404, "Questions not found", null);
    }

    // 5. Add the questions to the quiz object
    quiz.questions = questionsResult.Responses[TABLE_NAME.QUIZZES_QUESTIONS] || [];

    // 6. Return the quiz with questions
    return quiz;

  } catch (error) {
    console.error("Error fetching quiz with questions:", error.message);
    return sendResponse(500, "Internal Server Error", null);
  }
};

