// src/functions/updateLesson.js
import prisma from '../../db/prismaClient.js';
import { generateSlug, sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Extract the identifier from path parameters
    const { id } = event.pathParameters || {};
    
    if (!id) {
      return sendResponse(400, 'Missing lesson id', null);
    }

    // Parse the update payload from the request body
    const body = JSON.parse(event.body || '{}');
    
    if (!Object.keys(body).length) {
      return sendResponse(400, 'No update data provided', null);
    }

    // If title is updated, generate a new slug
    if (body.title) {
      body.slug = generateSlug(body.title);
    }

    let updatedLesson;

    // Determine if id is numeric (ID) or a slug (non-numeric)
    if (!isNaN(id)) {
      updatedLesson = await prisma.lesson.update({
        where: { id: parseInt(id, 10) },
        data: body,
      });
    } else {
      updatedLesson = await prisma.lesson.update({
        where: { slug: id },
        data: body,
      });
    }

    return sendResponse(200, 'Lesson updated successfully', updatedLesson);
  } catch (error) {
    console.error('Error updating lesson:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
