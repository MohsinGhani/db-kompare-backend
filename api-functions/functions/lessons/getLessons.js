// src/functions/getLessons.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Retrieve all lessons from the DB
    const lessons = await prisma.lesson.findMany();

    // Return success response with lessons data
    return sendResponse(200, "Lessons fetched successfully", lessons);
  } catch (error) {
    console.error("Error fetching lessons:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
