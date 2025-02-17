// src/functions/createQuestion.js
import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const {
      title,
      category,
      lessonId,
      difficulty,
      shortTitle,
      description,
      supportedRuntime,
      solutionExplanation,
      baseQuery,
      seoDescription,
      companyId,
      tags,              // Array of tag IDs
      questionType,
    } = JSON.parse(event.body || "{}");

    // Validate required fields (adjust validations as needed)
    if (!title || !category || !difficulty || !supportedRuntime || !questionType) {
      return sendResponse(400, "Missing required fields", null);
    }

  

    const questionItem = {
      id: uuidv4(),
      createdAt: getTimestamp(),
      category,
      lessonId: lessonId || null,
      difficulty,
      title,
      shortTitle: shortTitle || "",
      description: description || "",
      supportedRuntime,
      solutionExplanation: solutionExplanation || "",
      baseQuery: baseQuery || "",
      seoDescription: seoDescription || "",
      companyId: companyId || null,
      // Store tags as an array; adjust type if needed (e.g., as a set)
      tags: Array.isArray(tags) ? tags : [],
      questionType,
      status: "ACTIVE"
    };

    // Create the item in DynamoDB. The condition "attribute_not_exists(#id)"
    // ensures we don't overwrite an existing item with the same id.
    await createItemInDynamoDB(
      questionItem,
      TABLE_NAME.QUESTIONS,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );

    return sendResponse(200, "Question created successfully", questionItem);
  } catch (error) {
    console.error("Error creating question:", error);
    return sendResponse(500, "Error creating question", error.message);
  }
};
