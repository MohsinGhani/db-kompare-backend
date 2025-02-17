// src/functions/updateQuestionBySlug.js
import prisma from "../../db/prismaClient.js";
import { generateSlug, sendResponse } from "../../helpers/helpers.js";

const getUniqueSlug = async (baseSlug, currentQuestionId = null) => {
  let uniqueSlug = baseSlug;
  let count = 1;
  let existing;
  do {
    existing = await prisma.question.findFirst({
      where: {
        slug: uniqueSlug,
        // Exclude the current question from the check if updating
        ...(currentQuestionId && { id: { not: currentQuestionId } }),
      },
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
    // Get the question slug from the path parameters
    const { slug } = event.pathParameters || {};
    if (!slug) {
      return sendResponse(400, "Missing question slug", null);
    }

    // Find the existing question using the slug
    const existingQuestion = await prisma.question.findUnique({
      where: { slug },
    });
    if (!existingQuestion) {
      return sendResponse(404, "Question not found", null);
    }

    // Parse the update payload
    const body = JSON.parse(event.body || "{}");
    if (!Object.keys(body).length) {
      return sendResponse(400, "No update data provided", null);
    }

    // If the title is updated, generate a new unique slug
    if (body.title) {
      const baseSlug = generateSlug(body.title);
      body.slug = await getUniqueSlug(baseSlug, existingQuestion.id);
    }

    // Prepare update data
    const updateData = { ...body };

    // Handle updating tags if provided in the payload
    // Make sure the payload sends tags as an array of tag IDs: "tags": [1, 2, ...]
    if (body.tags) {
      updateData.tags = {
        set: body.tags.map((tagId) => ({ id: tagId })),
      };
    }

    // Update the question using its unique id
    const updatedQuestion = await prisma.question.update({
      where: { id: existingQuestion.id },
      data: updateData,
      include: { tags: true, company: true }, // Return the updated question along with its tags and company
    });

    return sendResponse(200, "Question updated successfully", updatedQuestion);
  } catch (error) {
    console.error("Error updating question:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
