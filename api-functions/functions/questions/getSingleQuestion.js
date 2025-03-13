import { sendResponse } from "../../helpers/helpers.js";
import {
  getItem,
  fetchItemsByIds,
  fetchAllItemByDynamodbIndex,
} from "../../helpers/dynamodb.js";
import { QUERY_STATUS, TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

    // Get the current question by ID
    const tableName = TABLE_NAME.QUESTIONS;
    const questionResult = await getItem(tableName, { id });

    if (!questionResult || !questionResult.Item) {
      return sendResponse(404, "Question not found", null);
    }

    const question = questionResult.Item;

    // Fetch related companies and tags
    const tagIds = question.tags || [];
    const companyIds = question.companyIds || [];

    const tags =
      tagIds.length > 0
        ? await fetchItemsByIds(TABLE_NAME.TAGS, tagIds, "id")
        : [];
    const companies =
      companyIds.length > 0
        ? await fetchItemsByIds(TABLE_NAME.COMPANIES, companyIds, "id")
        : [];

    // Enrich question with tag and company details
    const enrichedQuestion = {
      ...question,
      tags: tagIds.map(
        (tagId) =>
          tags.find((t) => t.id === tagId) || { id: tagId, name: "Unknown" }
      ),
      companies: companyIds.map(
        (companyId) =>
          companies.find((c) => c.id === companyId) || {
            id: companyId,
            name: "Unknown",
          }
      ),
    };

    // Fetch all active questions using the provided snippet.
    const status = QUERY_STATUS.ACTIVE;
    let questions = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUESTIONS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": status,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    // Sort the questions array based on questionNo
    questions = questions.sort((a, b) => a.questionNo - b.questionNo);

    // Determine the index of the current question in the sorted list
    const currentQuestionNo = question.questionNo;
    const currentIndex = questions.findIndex(
      (q) => q.questionNo === currentQuestionNo
    );

    let prevQuestion = null;
    let nextQuestion = null;

    if (currentIndex !== -1) {
      // Previous question: one with a lower questionNo if it exists
      if (currentIndex > 0) {
        prevQuestion = questions[currentIndex - 1];
      }
      // Next question: one with a higher questionNo if it exists
      if (currentIndex < questions.length - 1) {
        nextQuestion = questions[currentIndex + 1];
      }
    }

    enrichedQuestion.prevQuestion = prevQuestion;
    enrichedQuestion.nextQuestion = nextQuestion;

    return sendResponse(200, "Question fetched successfully", enrichedQuestion);
  } catch (error) {
    console.error("Error fetching question:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
