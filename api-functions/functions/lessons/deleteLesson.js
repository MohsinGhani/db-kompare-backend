// src/functions/deleteLesson.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Extract the identifier from the path parameters
    const { id } = event.pathParameters || {};
    
    if (!id) {
      return sendResponse(400, 'Missing lesson id', null);
    }

    let deletedLesson;

    // If the id is numeric, assume it's an ID; otherwise, assume it's a slug.
    if (!isNaN(id)) {
      deletedLesson = await prisma.lesson.delete({
        where: { id: parseInt(id, 10) },
      });
    } else {
      deletedLesson = await prisma.lesson.delete({
        where: { slug: id },
      });
    }

    return sendResponse(200, 'Lesson deleted successfully', deletedLesson);
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
