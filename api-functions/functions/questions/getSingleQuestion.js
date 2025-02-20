import { sendResponse } from "../../helpers/helpers.js";
import { getItem, fetchItemsByIds } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

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
      tags: tagIds?.map(
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

    return sendResponse(200, "Question fetched successfully", enrichedQuestion);
  } catch (error) {
    console.error("Error fetching question:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
