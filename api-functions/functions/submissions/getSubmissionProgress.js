import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import {
  DIFFICULTY,
  QUERY_STATUS,
  TABLE_NAME,
} from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Expect a userId query parameter
    const { userId } = event.queryStringParameters || {};

    // Fetch all active questions
    const questions = await getQuestions();

    // Categorize questions by difficulty
    const difficultyGroups = {
      EASY: [],
      MEDIUM: [],
      HARD: [],
    };

    // Organize questions based on difficulty
    questions.forEach((question) => {
      if (question.difficulty === DIFFICULTY.EASY) {
        difficultyGroups.EASY.push(question);
      } else if (question.difficulty === DIFFICULTY.MEDIUM) {
        difficultyGroups.MEDIUM.push(question);
      } else if (question.difficulty === DIFFICULTY.HARD) {
        difficultyGroups.HARD.push(question);
      }
    });

    // -------- FOR LOGGED IN USERS --------
    // If userId is provided, process submissions and calculate progress
    if (userId) {
      const submissions = (await getUserSubmission(userId)) || [];

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
      const latestSubmissions = Object.values(latestSubmissionsByQuestion);

      // Count the number of solved questions for each difficulty from the latest submissions
      const progress = {
        EASY: 0,
        MEDIUM: 0,
        HARD: 0,
      };

      latestSubmissions.forEach((submission) => {
        const questionId = submission.questionId;
        const question = questions.find((q) => q.id === questionId);

        if (question) {
          if (
            question.difficulty === DIFFICULTY.EASY &&
            submission.queryStatus
          ) {
            progress.EASY++;
          } else if (
            question.difficulty === DIFFICULTY.MEDIUM &&
            submission.queryStatus
          ) {
            progress.MEDIUM++;
          } else if (
            question.difficulty === DIFFICULTY.HARD &&
            submission.queryStatus
          ) {
            progress.HARD++;
          }
        }
      });

      // Prepare response data similar to the chart
      const totalQuestions = {
        EASY: difficultyGroups.EASY.length,
        MEDIUM: difficultyGroups.MEDIUM.length,
        HARD: difficultyGroups.HARD.length,
      };

      const totalSolved = {
        EASY: progress.EASY,
        MEDIUM: progress.MEDIUM,
        HARD: progress.HARD,
      };

      // Calculate overall progress percentage
      const totalQuestionsCount =
        totalQuestions.EASY + totalQuestions.MEDIUM + totalQuestions.HARD;
      const totalSolvedCount =
        totalSolved.EASY + totalSolved.MEDIUM + totalSolved.HARD;
      const progressPercentage = (totalSolvedCount / totalQuestionsCount) * 100;

      return sendResponse(
        200,
        "Latest submissions and progress fetched successfully",
        {
          progressPercentage: progressPercentage.toFixed(2),
          progress: {
            EASY: { solved: totalSolved.EASY, total: totalQuestions.EASY },
            MEDIUM: {
              solved: totalSolved.MEDIUM,
              total: totalQuestions.MEDIUM,
            },
            HARD: { solved: totalSolved.HARD, total: totalQuestions.HARD },
          },
        }
      );
    }

    // If userId is not provided, return only the total questions count by difficulty
    const totalQuestions = {
      EASY: difficultyGroups.EASY.length,
      MEDIUM: difficultyGroups.MEDIUM.length,
      HARD: difficultyGroups.HARD.length,
    };

    return sendResponse(200, "Questions count fetched successfully", {
      progressPercentage: 0, // As no user is logged in, set progress to 0%
      progress: {
        EASY: { solved: 0, total: totalQuestions.EASY },
        MEDIUM: { solved: 0, total: totalQuestions.MEDIUM },
        HARD: { solved: 0, total: totalQuestions.HARD },
      },
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return sendResponse(500, "Error fetching submissions", error.message);
  }
};

// -------------------    HELPER FUNCTIONS   ----------------------------

// Helper function to get user submissions from DynamoDB
const getUserSubmission = async (userId) => {
  const params = {
    TableName: TABLE_NAME.SUBMISSIONS,
    IndexName: "byUserId",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  };
  return await fetchAllItemByDynamodbIndex(params);
};

// Helper function to get all active questions from DynamoDB
const getQuestions = async () => {
  return await fetchAllItemByDynamodbIndex({
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
};
