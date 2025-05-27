// src/functions/getQuizzes.js
import { sendResponse } from "../../helpers/helpers.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, QUERY_STATUS } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const status = params.status || QUERY_STATUS.ACTIVE;
    const userId = params.userId;

    // Fetch quizzes by status using the byStatus GSI
    const quizzes = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUIZZES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
    });

    let quizzesWithTaken =
      quizzes?.map((quiz) => ({
        ...quiz,
        questions:
          quiz.questions?.map((q) => ({
            ...q,
            options: q.options?.map((o) => ({
             id: o?.id,
             text: o?.text,
            })),
          })) || [],
        taken: false,
      })) || [];
    if (userId) {
      // Fetch user's submissions to determine which quizzes are taken
      const submissions = await fetchAllItemByDynamodbIndex({
        TableName: TABLE_NAME.QUIZZES_SUBMISSIONS, // ensure your constants define this
        IndexName: "byUser", // ensure this GSI exists on your submissions table
        KeyConditionExpression: "#userId = :userId",
        ExpressionAttributeNames: { "#userId": "userId" },
        ExpressionAttributeValues: { ":userId": userId },
      });

      const takenQuizIds = new Set(submissions.map((s) => s.quizId));

      quizzesWithTaken = quizzes.map((quiz) => ({
        ...quiz,
        taken: takenQuizIds.has(quiz.id),
      }));
    }

    return sendResponse(200, "Quizzes fetched successfully", quizzesWithTaken);
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return sendResponse(500, "Error fetching quizzes", error.message);
  }
};
