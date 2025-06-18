import { checkAuthentication, sendResponse } from "../../helpers/helpers.js";
import { updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { TABLE_NAME, USER_ROLE } from "../../helpers/constants.js";
import { getItem } from "../../helpers/dynamodb.js";

export const handler = async (event) => {
  try {
    await checkAuthentication(event, [USER_ROLE.ADMINS]);
    // Get the question ID from the path parameters
    const { id } = event.pathParameters || {};

    if (!id) {
      return sendResponse(400, "Missing question ID", null);
    }

    // Find the existing question using the ID
    const tableName = TABLE_NAME.QUESTIONS;
    const existingQuestion = await getItem(tableName, { id });

    if (!existingQuestion || !existingQuestion.Item) {
      return sendResponse(404, "Question not found", null);
    }

    // Parse the update payload
    const body = JSON.parse(event.body || "{}");

    if (!Object.keys(body).length) {
      return sendResponse(400, "No update data provided", null);
    }

    // Prepare update expression dynamically
    let updateExpression = "set ";
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};
    let updateFields = [];

    // Include fields dynamically
    Object.keys(body).forEach((key) => {
      updateFields.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = body[key];
      expressionAttributeNames[`#${key}`] = key;
    });

    updateExpression += updateFields.join(", ");

    // Update the question using its unique id
    const updatedQuestion = await updateItemInDynamoDB({
      table: tableName,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    });

    return sendResponse(
      200,
      "Question updated successfully",
      updatedQuestion.Attributes
    );
  } catch (error) {
    console.error("Error updating question:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
