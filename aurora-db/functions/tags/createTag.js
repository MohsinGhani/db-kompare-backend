// src/functions/tags/createTag.js
import prisma from '../../db/prismaClient.js';
import { generateSlug, sendResponse } from '../../helpers/helpers.js';

// Helper to get a unique tag slug
const getUniqueTagSlug = async (baseSlug) => {
  let uniqueSlug = baseSlug;
  let count = 1;
  while (await prisma.tag.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${baseSlug}-${count}`;
    count++;
  }
  return uniqueSlug;
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { name, type } = body;
    
    // Validate required fields
    if (!name || !type) {
      return sendResponse(400, 'Missing required fields: name and type', null);
    }
    
    // Generate base slug and ensure its uniqueness
    const baseSlug = generateSlug(name);
    const uniqueSlug = await getUniqueTagSlug(baseSlug);

    const newTag = await prisma.tag.create({
      data: {
        name,
        slug: uniqueSlug,
        type
      }
    });
    
    return sendResponse(201, 'Tag created successfully', newTag);
  } catch (error) {
    console.error('Error creating tag:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
