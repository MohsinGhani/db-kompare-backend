import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchUserById } from "../common/fetchUserById.js";

export const handler = async (event) => {
  try {
    // Expecting query string parameters: questionId (optional), userId (optional), and type ("self" or "others")
    const { questionId, userId, type } = event.queryStringParameters || {};

    // Require at least one filter (questionId or userId)
    if (!questionId && !userId) {
      return sendResponse(
        400,
        "Missing required query parameter: at least one of questionId or userId",
        null
      );
    }

    // Default parameters object for the DynamoDB query
    const params = {
      TableName: TABLE_NAME.SUBMISSIONS,
      ExpressionAttributeValues: {},
    };

    // Determine which index and key condition to use
    // If questionId is provided, use byQuestionId index.
    if (questionId) {
      params.IndexName = "byQuestionId";
      params.KeyConditionExpression = "questionId = :questionId";
      params.ExpressionAttributeValues[":questionId"] = questionId;
    }
    // Otherwise, if only userId is provided, you could use the byUserId index.
    else if (userId) {
      params.IndexName = "byUserId";
      params.KeyConditionExpression = "userId = :userId";
      params.ExpressionAttributeValues[":userId"] = userId;
    }

    // If both questionId and userId are provided along with a type, add a FilterExpression
    if (questionId && userId && type) {
      if (type === "self") {
        params.FilterExpression = "userId = :userId";
        params.ExpressionAttributeValues[":userId"] = userId;
      } else if (type === "others") {
        params.FilterExpression = "userId <> :userId";
        params.ExpressionAttributeValues[":userId"] = userId;
      } else {
        return sendResponse(
          400,
          "Invalid type provided. Expected 'self' or 'others'.",
          null
        );
      }
    }

    // Fetch all matching submission items.
    const submissions = await fetchAllItemByDynamodbIndex(params);

    // Optionally, you can enrich each submission with user details if needed.
    const data =
      (await Promise.all(
        submissions.map(async (item) => ({
          ...item,
          user: await fetchUserById(item?.userId),
        }))
      )) || [];

    return sendResponse(200, "Submissions fetched successfully", data);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return sendResponse(500, "Error fetching submissions", error.message);
  }
};
