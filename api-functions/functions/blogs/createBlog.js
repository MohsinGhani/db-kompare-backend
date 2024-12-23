import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { createdBy, title, description, databases, status } = JSON.parse(
      event.body || "{}"
    );
    if (
      !createdBy ||
      !title ||
      !description ||
      !Array.isArray(databases) ||
      !status
    ) {
      return sendResponse(400, "Missing or invalid fields", false);
    }

    const blogItem = {
      id: uuidv4(),
      createdBy,
      createdAt: getTimestamp(),
      title,
      description,
      databases,
      status,
    };

    await createItemInDynamoDB(
      blogItem,
      TABLE_NAME.BLOGS,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );

    return sendResponse(200, "Blog Created Successfully", blogItem);
  } catch (error) {
    return sendResponse(500, "Error creating blog", error.message);
  }
};
