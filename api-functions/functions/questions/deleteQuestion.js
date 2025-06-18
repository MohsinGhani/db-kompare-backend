// src/functions/deleteQuestion.js
import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { deleteItem, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    
    const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

    // Check if the question exists using its ID
    const questionTable = TABLE_NAME.QUESTIONS;
    const existingQuestion = await getItem(questionTable, { id });

    if (!existingQuestion || !existingQuestion.Item) {
      return sendResponse(404, "Question not found", null);
    }

    // Delete the question from the QUESTIONS table
    const deletedQuestion = await deleteItem(
      questionTable,
      { id },
      { "#id": "id" },
      "attribute_exists(#id)"
    );

    if (!deletedQuestion.Attributes) {
      return sendResponse(404, "Question not found or already deleted", null);
    }

    return sendResponse(
      200,
      "Question and its solution deleted successfully",
      deletedQuestion.Attributes
    );
  } catch (error) {
    console.error("Error deleting question:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
