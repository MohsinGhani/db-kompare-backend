// src/functions/deleteQuiz.js
import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { deleteItem, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    // Extract quiz ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing quiz ID", null);
    }

    // Verify quiz exists
    const quizTable = TABLE_NAME.QUIZZES;
    const existingQuiz = await getItem(quizTable, { id });
    if (!existingQuiz || !existingQuiz.Item) {
      return sendResponse(404, "Quiz not found", null);
    }

    // Delete the quiz record
    const deleted = await deleteItem(
      quizTable,
      { id },
      { "#id": "id" },
      "attribute_exists(#id)"
    );

    if (!deleted.Attributes) {
      return sendResponse(404, "Quiz not found or already deleted", null);
    }

    return sendResponse(200, "Quiz deleted successfully", deleted.Attributes);
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
