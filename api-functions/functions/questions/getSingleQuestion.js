import { sendResponse } from "../../helpers/helpers.js";
import { getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

    const tableName = TABLE_NAME.QUESTIONS;
    const question = await getItem(tableName, { id });

    if (!question || !question.Item) {
      return sendResponse(404, "Question not found", null);
    }

    return sendResponse(200, "Question fetched successfully", question.Item);
  } catch (error) {
    console.error("Error fetching question:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
