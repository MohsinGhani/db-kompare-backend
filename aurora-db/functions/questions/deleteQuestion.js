// src/functions/questions/deleteQuestionBySlug.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    const { slug } = event.pathParameters || {};
    if (!slug) {
      return sendResponse(400, 'Missing question slug', null);
    }

    // Check if the question exists using its slug
    const existingQuestion = await prisma.question.findUnique({
      where: { slug }
    });
    
    if (!existingQuestion) {
      return sendResponse(404, 'Question not found', null);
    }

    // Delete the question using its id
    const deletedQuestion = await prisma.question.delete({
      where: { id: existingQuestion.id }
    });

    return sendResponse(200, 'Question deleted successfully', deletedQuestion);
  } catch (error) {
    console.error('Error deleting question:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
