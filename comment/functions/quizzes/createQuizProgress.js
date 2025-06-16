import { TABLE_NAME } from "../../helpers/constants.js";
import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

const DEFAULT_TIME_LIMIT = 1800;  // 30 minutes in seconds

export const handler = async (event) => {
  try {
    const {
      userId,
      quizId,
      questionIds,
      timeLimit: inputLimit,
    } = JSON.parse(event.body || "{}");

    // 1) Validate inputs
    if (
      !userId ||
      !quizId ||
      !Array.isArray(questionIds) ||
      questionIds.length === 0
    ) {
      return sendResponse(
        400,
        "Missing required fields: userId, quizId, questionIds (non-empty array)",
        null
      );
    }

    // 2) Compute time fields
    const startedAt     = getTimestamp();                       // ISO string
    const remainingTime = inputLimit ?? DEFAULT_TIME_LIMIT;     // seconds

    // 3) Build the progress item (no TTL)
    const progressItem = {
      userId,                  // PK
      quizId,                  // SK
      questionIds,             // exact list/order of questions
      currentIndex: 0,         // start at question 0
      remainingTimeSec: remainingTime,
      answersMap: {},          // { questionId: [...optionIds] }
      startedAt,
      lastUpdatedAt: startedAt,
    };

    // 4) Write—but only if no existing in-flight record
    await createItemInDynamoDB(
      progressItem,
      TABLE_NAME.QUIZ_PROGRESS,                              
      { "#uid": "userId", "#qid": "quizId" },
      "attribute_not_exists(#uid) AND attribute_not_exists(#qid)",
      false
    );

    // 5) Return the newly created progress back to the client
    return sendResponse(200, "Quiz progress initialized", progressItem);
  } catch (error) {
    console.error("Error creating quiz progress:", error);
    return sendResponse(
      500,
      "Internal error creating quiz progress",
      error.message || error
    );
  }
};
