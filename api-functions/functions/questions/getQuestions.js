import { sendResponse } from "../../helpers/helpers.js";
import {
  fetchAllItemByDynamodbIndex,
  fetchItemsByIds,
} from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async () => {
  try {
    const status = "ACTIVE";

    // Fetch questions with active status
    const questions = await fetchAllItemByDynamodbIndex({
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

    // Extract unique tag IDs and company IDs from all questions
    const tagIds = [...new Set(questions.flatMap((q) => q.tags || []))];
    const companyIds = [
      ...new Set(questions.flatMap((q) => q.companyIds || [])),
    ];

    // Fetch tag details
    const tags =
      tagIds.length > 0
        ? await fetchItemsByIds(TABLE_NAME.TAGS, tagIds, "id")
        : [];

    // Fetch company details
    const companies =
      companyIds.length > 0
        ? await fetchItemsByIds(TABLE_NAME.COMPANIES, companyIds, "id")
        : [];

    // Map tags and companies to their respective questions
    const enrichedQuestions = questions.map((q) => ({
      ...q,
      tags:
        q.tags?.map(
          (tagId) =>
            tags.find((t) => t.id === tagId) || { id: tagId, name: "Unknown" }
        ) || [],
      companies:
        q.companyIds?.map(
          (companyId) =>
            companies.find((c) => c.id === companyId) || {
              id: companyId,
              name: "Unknown",
            }
        ) || [],
    }));

    return sendResponse(
      200,
      "Questions fetched successfully",
      enrichedQuestions
    );
  } catch (error) {
    console.error("Error fetching questions:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
