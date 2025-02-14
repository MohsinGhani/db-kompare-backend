// src/functions/tags/deleteTag.js
import prisma from '../../db/prismaClient.js';
import { sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Get tag ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, 'Missing tag ID', null);
    }
    
    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id: parseInt(id, 10) }
    });
    if (!existingTag) {
      return sendResponse(404, 'Tag not found', null);
    }
    
    const deletedTag = await prisma.tag.delete({
      where: { id: parseInt(id, 10) }
    });
    
    return sendResponse(200, 'Tag deleted successfully', deletedTag);
  } catch (error) {
    console.error('Error deleting tag:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
