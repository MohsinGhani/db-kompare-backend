// src/functions/createQuestion.js
import {
  createItemInDynamoDB,
  fetchAllItemByDynamodbIndex,
} from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import {
  QUERY_STATUS,
  TABLE_NAME,
  USER_ROLE,
} from "../../helpers/constants.js";
import {
  checkAuthentication,
  getTimestamp,
  sendResponse,
} from "../../helpers/helpers.js";
import {
  TOPICS_CATEGORIES,
  SUPPORTED_RUNTIME,
  DIFFICULTY,
  QUESTION_TYPE,
} from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    const {
      title,
      categories,
      lessonId,
      difficulty,
      shortTitle,
      description,
      supportedRuntime,
      solutionExplanation,
      baseQuery,
      seoDescription,
      companyIds,
      tags, // Array of tag IDs
      questionType,
      access,
      proper_query,
      // Optionally, you can pass in solutionData if available
      solutionData, // expected solution output in canonical JSON format (optional)
    } = JSON.parse(event.body || "{}");

    // Validate required fields
    if (
      !title ||
      !categories ||
      !difficulty ||
      !supportedRuntime ||
      !questionType
    ) {
      return sendResponse(400, "Missing required fields", null);
    }

    // Validate difficulty level
    if (!Object.values(DIFFICULTY).includes(difficulty)) {
      return sendResponse(
        400,
        `Invalid difficulty level provided: ${difficulty}. Expected values: ${Object.values(
          DIFFICULTY
        ).join(", ")}`,
        null
      );
    }

    // Validate supported runtime
    if (
      !Array.isArray(supportedRuntime) ||
      supportedRuntime.some(
        (rt) => !Object.values(SUPPORTED_RUNTIME).includes(rt)
      )
    ) {
      return sendResponse(
        400,
        `Invalid supported runtime provided: ${supportedRuntime}. Expected values: ${Object.values(
          SUPPORTED_RUNTIME
        ).join(", ")}`,
        null
      );
    }

    // Validate categories
    if (
      !Array.isArray(categories) ||
      categories.some((cat) => !Object.values(TOPICS_CATEGORIES).includes(cat))
    ) {
      return sendResponse(
        400,
        `Invalid category provided: ${categories}. Expected values: ${Object.values(
          TOPICS_CATEGORIES
        ).join(", ")}`,
        null
      );
    }

    // Validate question type
    if (
      !Array.isArray(questionType) ||
      questionType.some((qt) => !Object.values(QUESTION_TYPE).includes(qt))
    ) {
      return sendResponse(
        400,
        `Invalid question type provided: ${questionType}. Expected values: ${Object.values(
          QUESTION_TYPE
        ).join(", ")}`,
        null
      );
    }

    // Fetch all questions to add question number
    const questions = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUESTIONS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": QUERY_STATUS.ACTIVE,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    const questionItem = {
      id: uuidv4(),
      createdAt: getTimestamp(),
      categories: categories,
      lessonId: lessonId || null,
      difficulty,
      title,
      shortTitle: shortTitle || "",
      description: description || "",
      supportedRuntime: supportedRuntime,
      solutionExplanation: solutionExplanation || "",
      baseQuery: baseQuery || "",
      seoDescription: seoDescription || "",
      companyIds: Array.isArray(companyIds) ? companyIds : [],
      tags: Array.isArray(tags) ? tags : [],
      questionType: questionType,
      status: QUERY_STATUS.ACTIVE,
      access,
      proper_query,
      questionNo: +questions?.length + 1,
      solutionData: solutionData || [],
    };

    // Create the question item in the QUESTIONS table
    await createItemInDynamoDB(
      questionItem,
      TABLE_NAME.QUESTIONS,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );

    return sendResponse(200, "Question created successfully", questionItem);
  } catch (error) {
    console.error("Error creating question:", error);
    return sendResponse(500, "Error creating question", error.message);
  }
};
