// src/functions/createQuiz.js
import {
  createItemInDynamoDB,
  fetchAllItemByDynamodbIndex,
} from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { QUERY_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const {
      name,
      passingPerc,
      category,
      difficulty,
      description,
      questions,
      totalQuestions,
      createdBy,
      // Any other quiz-level fields can go here
    } = JSON.parse(event.body || "{}");

    // Validate required fields
    if (!name || passingPerc == null || !category || !difficulty) {
      return sendResponse(
        400,
        "Missing required fields: name, passingPerc, category, difficulty",
        null
      );
    }

    // Optionally validate questions
    if (!Array.isArray(questions) || questions.length === 0) {
      return sendResponse(400, "Questions must be a non-empty array", null);
    }

    // Fetch all active quizzes to assign quizNo
    const existing = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUIZZES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": QUERY_STATUS.ACTIVE,
      },
    });

    const quizNo = (existing.length || 0) + 1;

    const quizItem = {
      id: uuidv4(),
      createdAt: getTimestamp(),
      name,
      passingPerc,
      category,
      difficulty,
      description: description || "",
      questions,
      status: QUERY_STATUS.ACTIVE,
      quizNo,
      totalQuestions,
      createdBy,
    };

    // Write quiz record
    await createItemInDynamoDB(
      quizItem,
      TABLE_NAME.QUIZZES,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );

    return sendResponse(200, "Quiz created successfully", quizItem);
  } catch (error) {
    console.error("Error creating quiz:", error);
    return sendResponse(500, "Error creating quiz", error.message || error);
  }
};
