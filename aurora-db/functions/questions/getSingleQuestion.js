// src/functions/getSingleQuestionBySlug.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    const { slug } = event.pathParameters || {};
    if (!slug) {
      return sendResponse(400, 'Missing question slug', null);
    }

    const question = await prisma.question.findUnique({
      where: { slug },
      include:{
        company:true,
        tag:true
      }
    });

    if (!question) {
      return sendResponse(404, 'Question not found', null);
    }

    return sendResponse(200, 'Question fetched successfully', question);
  } catch (error) {
    console.error('Error fetching question:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
