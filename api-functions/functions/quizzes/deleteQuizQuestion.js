// src/functions/deleteQuizQuestion.js

import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { deleteItem, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    // 1. Extract question ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

    // 2. Verify question exists
    const questionTable = TABLE_NAME.QUIZZES_QUESTIONS;
    const existingQuestion = await getItem(questionTable, { id });
    if (!existingQuestion || !existingQuestion.Item) {
      return sendResponse(404, "Question not found", null);
    }

    // 3. Delete the question record
    const deleted = await deleteItem(
      questionTable,
      { id },
      { "#id": "id" },
      "attribute_exists(#id)"
    );

    if (!deleted.Attributes) {
      return sendResponse(404, "Question not found or already deleted", null);
    }

    // 4. Return success with deleted attributes
    return sendResponse(
      200,
      "Quiz question deleted successfully",
      deleted.Attributes
    );
  } catch (error) {
    console.error("Error deleting quiz question:", error);
    return sendResponse(500, "Internal server error", error.message);
  }
};
