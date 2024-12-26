import { createItemInDynamoDB, getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { userId, blogId } = JSON.parse(event.body);

    // Validate input
    if (!userId || !blogId) {
      return sendResponse(400, "userId and blogId are required.");
    }

    // Check if the blog exists
    const existingItem = await getItem(TABLE_NAME.BLOGS, { id: blogId });

    if (!existingItem || !existingItem.Item) {
      return sendResponse(404, "Blog does not exist.");
    }

    const savedAt = getTimestamp();

    // Define the item to be saved
    const itemAttributes = {
      userId,
      blogId,
      savedAt,
    };

    // Define expression attributes and condition to prevent duplicates
    const expressionAttributes = {
      "#blogId": "blogId", // Mapping attribute names to prevent conflicts
    };
    const conditionExpression = "attribute_not_exists(#blogId)";

    // Call the helper function to save the item in DynamoDB
    await createItemInDynamoDB(
      itemAttributes,
      TABLE_NAME.SAVED_BLOGS,
      expressionAttributes,
      conditionExpression
    );

    return sendResponse(200, "Blog saved successfully.");
  } catch (error) {
    console.error("Error saving blog:", error);

    if (error.code === "ConditionalCheckFailedException") {
      return sendResponse(400, "Blog is already saved.");
    }
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
