import { getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { userId, quizId } = event.queryStringParameters || {};

    // 1) Validate inputs
    if (!userId || !quizId) {
      return sendResponse(
        400,
        "Missing required query parameters: userId and quizId",
        null
      );
    }

    // 2) Fetch the progress item by PK/SK
    const result = await getItem(TABLE_NAME.QUIZ_PROGRESS, { userId, quizId });
    const progress = result.Item;

    // 3) If not found, return 404
    if (!progress) {
      return sendResponse(404, "No in-progress quiz found for these identifiers", {});
    }

    // 4) Return the stored progress
    return sendResponse(
      200,
      "Quiz progress fetched successfully",
      progress
    );
  } catch (error) {
    console.error("Error fetching quiz progress:", error);
    return sendResponse(
      500,
      "Internal server error while fetching quiz progress",
      error.message || null
    );
  }
};
