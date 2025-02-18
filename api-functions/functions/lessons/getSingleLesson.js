// src/functions/getSingleLesson.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Extract the id from path parameters (which can be numeric or a slug)
    const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, 'Missing lesson identifier', null);
    }

    let lesson;

    // Check if the id is numeric; if so, treat it as an ID; otherwise, as a slug.
    if (!isNaN(id)) {
      lesson = await prisma.lesson.findUnique({
        where: { id: parseInt(id, 10) },
      });
    } else {
      lesson = await prisma.lesson.findUnique({
        where: { slug: id },
      });
    }

    if (!lesson) {
      return sendResponse(404, 'Lesson not found', null);
    }

    return sendResponse(200, 'Lesson retrieved successfully', lesson);
  } catch (error) {
    console.error('Error retrieving lesson:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
