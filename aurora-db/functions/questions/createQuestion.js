// src/functions/createQuestion.js
import prisma from '../../db/prismaClient.js';
import { generateSlug, sendResponse } from '../../helpers/helpers.js';

const getUniqueSlug = async (baseSlug) => {
  let uniqueSlug = baseSlug;
  let count = 1;
  // Loop until no question is found with the current uniqueSlug
  while (await prisma.question.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${baseSlug}-${count}`;
    count++;
  }
  return uniqueSlug;
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      title,
      shortTitle,
      description,
      difficulty,
      category,
      supportedRuntime,
      solutionExplanation,
      baseQuery,
      seoDescription,
      questionType,
      lessonId,
      companyId,
      tags // ensure the payload sends `tags`
    } =body

    if (!title) {
      return sendResponse(400, 'Missing "title"', null);
    }

    // Generate a base slug and then a unique slug
    const baseSlug = generateSlug(title);
    const uniqueSlug = await getUniqueSlug(baseSlug);

    // Create a new question record with the unique slug
    const question = await prisma.question.create({
      data: {
        title,
        slug: uniqueSlug,
        shortTitle,
        description,
        difficulty,
        category,
        supportedRuntime,
        solutionExplanation,
        baseQuery,
        seoDescription,
        questionType,
        lessonId,
        companyId,
        tags: {
          connect: tags.map(tagId => ({ id: tagId }))
        }
      }
    });

    return sendResponse(201, 'Question created successfully', question);
  } catch (error) {
    console.error('Error creating question:', error);
    return sendResponse(500, 'Internal server error', { error: error.message });
  }
};
