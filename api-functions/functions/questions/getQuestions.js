// src/functions/getQuestions.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async () => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        company: true,
        tags: true
      }
    });
    
    return sendResponse(200, 'Questions fetched successfully', questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
