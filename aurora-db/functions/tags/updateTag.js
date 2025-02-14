// src/functions/tags/updateTag.js
import prisma from '../../db/prismaClient.js';
import { generateSlug, sendResponse } from '../../helpers/helpers.js';

// Helper to get a unique tag slug, excluding the current tag (if updating)
const getUniqueTagSlug = async (baseSlug, currentTagId = null) => {
  let uniqueSlug = baseSlug;
  let count = 1;
  let existing;
  do {
    existing = await prisma.tag.findFirst({
      where: {
        slug: uniqueSlug,
        ...(currentTagId && { id: { not: currentTagId } })
      }
    });
    if (existing) {
      uniqueSlug = `${baseSlug}-${count}`;
      count++;
    }
  } while (existing);
  return uniqueSlug;
};

export const handler = async (event) => {
  try {
    // Get tag ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, 'Missing tag ID', null);
    }
    
    const body = JSON.parse(event.body || '{}');
    if (!Object.keys(body).length) {
      return sendResponse(400, 'No update data provided', null);
    }
    
    // If name is updated, generate a new unique slug
    if (body.name) {
      const baseSlug = generateSlug(body.name);
      body.slug = await getUniqueTagSlug(baseSlug, parseInt(id, 10));
    }
    
    const updatedTag = await prisma.tag.update({
      where: { id: parseInt(id, 10) },
      data: body,
    });
    
    return sendResponse(200, 'Tag updated successfully', updatedTag);
  } catch (error) {
    console.error('Error updating tag:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
