import prisma from '../../db/prismaClient.js';
import { generateSlug, sendResponse } from '../../helpers/helpers.js';

export const handler = async (event) => {
  try {
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const { name, icon } = body;

    // Validate required field
    if (!name) {
      return sendResponse(400, 'Missing "name"', null);
    }

    // Generate a slug from the company name using your common function
    const slug = generateSlug(name);

    // Create the company record in the database
    const newCompany = await prisma.company.create({
      data: {
        name,
        slug,
        icon: icon || null, // icon is optional
      },
    });

    // Return a success response
    return sendResponse(201, 'Company created successfully', newCompany);
  } catch (error) {
    console.error('Error creating company:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
