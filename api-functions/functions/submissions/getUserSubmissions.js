import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchUserById } from "../common/fetchUserById.js";

export const handler = async (event) => {
  try {
    // Expect a userId query parameter
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return sendResponse(
        400,
        "Missing required query parameter: userId",
        null
      );
    }

    // Query the submissions table using the byUserId index for this user
    const params = {
      TableName: TABLE_NAME.SUBMISSIONS,
      IndexName: "byUserId",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };

    const submissions = (await fetchAllItemByDynamodbIndex(params)) || [];

    // Group submissions by questionId and select only the latest submission for each question
    const latestSubmissionsByQuestion = submissions.reduce(
      (acc, submission) => {
        const qid = submission.questionId;
        // If no submission for this question exists yet, or if this submission's timestamp is greater, update it.
        if (!acc[qid] || submission.submittedAt > acc[qid].submittedAt) {
          acc[qid] = submission;
        }
        return acc;
      },
      {}
    );

    // Convert the grouped object into an array of latest submissions
    const latestSubmissions = Object.values(latestSubmissionsByQuestion) || [];

    // Optionally enrich each submission with user details
    const enrichedSubmissions =
      (await Promise.all(
        latestSubmissions.map(async (sub) => ({
          ...sub,
          user: await fetchUserById(sub.userId),
        }))
      )) || [];

    return sendResponse(
      200,
      "Latest submissions fetched successfully",
      enrichedSubmissions
    );
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return sendResponse(500, "Error fetching submissions", error.message);
  }
};
