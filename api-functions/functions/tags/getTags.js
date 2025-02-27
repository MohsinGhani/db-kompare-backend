import { sendResponse } from "../../helpers/helpers.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async () => {
  try {
    const tagStatus = "ACTIVE"; // Change as needed for tags
    const questionStatus = "ACTIVE"; // Change as needed for questions

    // Fetch all active tags
    const tags = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.TAGS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": tagStatus,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    // Fetch all active questions (which contain tags array with tag IDs)
    const questions = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.QUESTIONS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": questionStatus,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    // Create a map to count how many questions are attached to each tag.
    const tagCountMap = {};

    questions.forEach((question) => {
      if (Array.isArray(question.tags)) {
        question.tags.forEach((tagId) => {
          tagCountMap[tagId] = (tagCountMap[tagId] || 0) + 1;
        });
      }
    });

    // Enrich each tag with the count from tagCountMap
    const enrichedTags = tags.map((tag) => ({
      ...tag,
      count: tagCountMap[tag.id] || 0,
    }));

    return sendResponse(200, "Tags fetched successfully", enrichedTags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
