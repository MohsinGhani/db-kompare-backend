import { sendResponse } from "../../helpers/helpers.js";
import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { v4 as uuidv4 } from "uuid";
import { getTimestamp } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Parse the request body
    const body = JSON.parse(event.body || "{}");
    const { name, icon } = body;

    // Validate required field
    if (!name) {
      return sendResponse(400, 'Missing "name"', null);
    }

    // Generate a unique ID
    const id = uuidv4();
    const createdAt = getTimestamp();
    const updatedAt = createdAt;

    // Prepare item attributes
    const itemAttributes = {
      id,
      name,
      icon: icon || null, // icon is optional
      status: "ACTIVE",
      createdAt,
      updatedAt,
    };

    // Create the company record in DynamoDB
    await createItemInDynamoDB(itemAttributes, TABLE_NAME.COMPANIES);

    // Return a success response
    return sendResponse(201, "Company created successfully", itemAttributes);
  } catch (error) {
    console.error("Error creating company:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
