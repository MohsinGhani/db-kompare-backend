// src/functions/createLesson.js
import prisma from '../../db/prismaClient.js';
import { generateSlug, sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { title, shortTitle, shortDescription, description, category, type } = body;

    // Check required fields
    if (!title) {
      return sendResponse(400, 'Missing "title"', null);
    }

    // Generate base slug from title
    const baseSlug = generateSlug(title);
    let uniqueSlug = baseSlug;
    let count = 1;

    // Loop until a unique slug is found
    while (await prisma.lesson.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${count}`;
      count++;
    }

    // Create lesson in DB using the unique slug
    const newLesson = await prisma.lesson.create({
      data: {
        title,
        slug: uniqueSlug,
        shortTitle,
        shortDescription,
        description,
        category,
        type
      },
    });

    // Return success response
    return sendResponse(201, 'Lesson created successfully', newLesson);

  } catch (error) {
    console.error('Error creating lesson:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
