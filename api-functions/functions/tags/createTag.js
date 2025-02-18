import { sendResponse } from "../../helpers/helpers.js";
import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { v4 as uuidv4 } from "uuid";
import { getTimestamp } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { name, tag_type } = body;

    // Validate required fields
    if (!name) {
      return sendResponse(400, "Missing required fields: name", null);
    }

    // Generate a unique ID and timestamps
    const id = uuidv4();
    const createdAt = getTimestamp();
    const updatedAt = createdAt;

    // Prepare item attributes
    const itemAttributes = {
      id,
      name,
      tag_type: tag_type || null,
      status: "ACTIVE",
      createdAt,
      updatedAt,
    };

    // Create the tag record in DynamoDB
    await createItemInDynamoDB(itemAttributes, TABLE_NAME.TAGS);

    return sendResponse(201, "Tag created successfully", itemAttributes);
  } catch (error) {
    console.error("Error creating tag:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
