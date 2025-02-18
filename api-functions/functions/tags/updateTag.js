import { sendResponse } from "../../helpers/helpers.js";
import { updateItemInDynamoDB, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event) => {
  try {
    // Get tag ID from path parameters
    const { id } = event.pathParameters || {};
    if (!id) {
      return sendResponse(400, "Missing tag ID", null);
    }

    // Check if the tag exists
    const existingTag = await getItem(TABLE_NAME.TAGS, { id });
    if (!existingTag || !existingTag.Item) {
      return sendResponse(404, "Tag not found", null);
    }

    const body = JSON.parse(event.body || "{}");
    if (!Object.keys(body).length) {
      return sendResponse(400, "No update data provided", null);
    }

    // Prepare update expression dynamically
    let updateExpression = "set ";
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};
    let updateFields = [];

    Object.keys(body).forEach((key) => {
      updateFields.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = body[key];
      expressionAttributeNames[`#${key}`] = key;
    });

    updateExpression += updateFields.join(", ");

    // Update the tag in DynamoDB
    const updatedTag = await updateItemInDynamoDB({
      table: TABLE_NAME.TAGS,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW",
    });

    return sendResponse(200, "Tag updated successfully", updatedTag.Attributes);
  } catch (error) {
    console.error("Error updating tag:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
