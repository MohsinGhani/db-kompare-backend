// src/functions/createQuizQuestions.js

import { batchWriteItems } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { QUERY_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // 1. Parse the payload as a JSON array
    const questionArray = JSON.parse(event.body);
    
    if (!Array.isArray(questionArray) || questionArray.length === 0) {
      return sendResponse(
        400,
        "Request body must be a non-empty array of questions",
        null
      );
    }

    const itemsToWrite = [];

    // 2. Iterate over each question payload and build the item
    questionArray.forEach((raw, idx) => {
      const {
        question,
        options,
        explanation = "",
        image = null,
        difficulty = "MEDIUM",
        category = "",
        tags = [],
      } = raw ?? {};

      // 2a. Validate required fields
      if (typeof question !== "string" || question.trim() === "") {
        throw new Error(`Item ${idx}: "question" must be a non-empty string`);
      }
      if (!Array.isArray(options) || options.length === 0) {
        throw new Error(
          `Item ${idx}: "options" must be a non-empty array of { text, isCorrect }`
        );
      }

      // 2b. Validate each option and assign a UUID
      const normalizedOptions = options.map((opt, optIdx) => {
        if (
          !opt ||
          typeof opt.text !== "string" ||
          opt.text.trim() === "" ||
          typeof opt.isCorrect !== "boolean"
        ) {
          throw new Error(
            `Item ${idx}, option ${optIdx}: each option must have { text: non-empty string, isCorrect: boolean }`
          );
        }
        return {
          id: uuidv4(),
          text: opt.text.trim(),
          isCorrect: opt.isCorrect,
        };
      });

      // 2c. Compute correctCount and isMultipleAnswer
      const correctCount = normalizedOptions.filter((o) => o.isCorrect).length;
      if (correctCount === 0) {
        throw new Error(
          `Item ${idx}: at least one option must have isCorrect: true`
        );
      }
      const isMultipleAnswer = correctCount > 1;

      // 2d. Construct the DynamoDB item
      const questionItem = {
        id: uuidv4(),
        createdAt: getTimestamp(),
        question: question.trim(),
        options: normalizedOptions,
        correctCount,
        isMultipleAnswer,
        explanation,
        image,
        difficulty,
        category,
        tags: Array.isArray(tags) ? tags : [],
        status: QUERY_STATUS.ACTIVE,
      };

      // 2e. Collect for batch write and keep for response
      itemsToWrite.push(questionItem);
    });

    // 3. Batch-write all items (DynamoDB allows up to 25 items per request)
    await batchWriteItems(TABLE_NAME.QUIZZES_QUESTIONS, itemsToWrite);

    // 4. Return all created items
    return sendResponse(
      200,
      "Quiz questions created successfully",
      itemsToWrite
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendResponse(400, "Malformed JSON in request body", null);
    }
    if (error.message?.startsWith("Item")) {
      return sendResponse(400, error.message, null);
    }
    console.error("Unexpected error:", error);
    return sendResponse(
      500,
      "Internal server error while creating quiz questions",
      error.message || null
    );
  }
};
