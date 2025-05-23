// src/functions/submitQuiz.js
import { getItem, createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { TABLE_NAME, QUIZ_SUBMISSION_STATUS } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { quizId, userId, answers } = JSON.parse(event.body || "{}");

    // Validate required fields
    if (!quizId || !userId || !answers) {
      return sendResponse(400, "Missing required fields: quizId, userId, answers", null);
    }

    // Fetch the quiz
    const quizResult = await getItem(TABLE_NAME.QUIZZES, { id: quizId });
    if (!quizResult || !quizResult.Item) {
      return sendResponse(404, "Quiz not found", null);
    }
    const quiz = quizResult.Item;

    // Validate answers structure
    if (!Array.isArray(answers) || answers.length === 0) {
      return sendResponse(400, "Answers must be a non-empty array", null);
    }

    // Calculate score
    const { correctCount, totalScore } = calculateQuizScore(quiz.questions, answers);

    // Determine pass/fail status
    const percentageScore = (correctCount / quiz.questions.length) * 100;
    const passed = percentageScore >= quiz.passingPerc;

    // Create submission record
    const submissionId = uuidv4();
    const submissionItem = {
      id: submissionId,
      quizId,
      userId,
      createdAt: getTimestamp(),
      answers,
      correctCount,
      totalQuestions: quiz.questions.length,
      totalScore,
      percentageScore,
      passingPercentage: quiz.passingPerc,
      status: passed ? QUIZ_SUBMISSION_STATUS.PASSED : QUIZ_SUBMISSION_STATUS.FAILED,
      quizDetails: {
        name: quiz.name,
        category: quiz.category,
        difficulty: quiz.difficulty
      }
    };

    // Write submission record
    await createItemInDynamoDB(
      submissionItem,
      TABLE_NAME.QUIZZES_SUBMISSIONS,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );

    return sendResponse(200, "Quiz submitted successfully", {
      submissionId,
      correctCount,
      totalQuestions: quiz.questions.length,
      percentageScore,
      passed,
      passingPercentage: quiz.passingPerc
    });

  } catch (error) {
    console.error("Error submitting quiz:", error);
    return sendResponse(500, "Error submitting quiz", error.message || error);
  }
};

// Helper function to calculate quiz score
function calculateQuizScore(questions, userAnswers) {
  let correctCount = 0;
  let totalScore = 0;

  questions.forEach(question => {
    const userAnswer = userAnswers.find(a => a.questionId === question.id);
    if (!userAnswer) return;

    const correctOptions = question.options
      .filter(opt => opt.isCorrect)
      .map(opt => opt.id);

    // For multiple answer questions, check if all correct options are selected
    if (question.isMultipleAnswer) {
      const allCorrectSelected = correctOptions.every(optId => 
        userAnswer.selectedOptionIds.includes(optId)
      );
      const noIncorrectSelected = userAnswer.selectedOptionIds.every(optId => 
        correctOptions.includes(optId)
      );

      if (allCorrectSelected && noIncorrectSelected) {
        correctCount++;
        totalScore += question.points || 1;
      }
    } 
    // For single answer questions
    else {
      if (userAnswer.selectedOptionIds.length === 1 && 
          correctOptions.includes(userAnswer.selectedOptionIds[0])) {
        correctCount++;
        totalScore += question.points || 1;
      }
    }
  });

  return { correctCount, totalScore };
}