// src/functions/tags/getTags.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async () => {
  try {
    const tags = await prisma.tag.findMany();
    return sendResponse(200, 'Tags fetched successfully', tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
