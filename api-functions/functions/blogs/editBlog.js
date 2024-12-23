import { updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { id, title, description, databases, status } = JSON.parse(
      event.body || "{}"
    );
    if (!id || (!title && !description && !databases && !status)) {
      return sendResponse(400, "Missing required fields for updating", false);
    }

    const updateFields = [];
    const attributeValues = {};
    const attributeNames = {};

    if (title) {
      updateFields.push("#title = :title");
      attributeValues[":title"] = title;
      attributeNames["#title"] = "title";
    }

    if (description) {
      updateFields.push("#description = :description");
      attributeValues[":description"] = description;
      attributeNames["#description"] = "description";
    }

    if (databases) {
      updateFields.push("#databases = :databases");
      attributeValues[":databases"] = databases;
      attributeNames["#databases"] = "databases";
    }

    if (status) {
      updateFields.push("#status = :status");
      attributeValues[":status"] = status;
      attributeNames["#status"] = "status";
    }

    if (updateFields.length === 0) {
      return sendResponse(400, "No Change in data.", false);
    }

    updateFields.push("#updatedAt = :updatedAt");
    attributeValues[":updatedAt"] = getTimestamp();
    attributeNames["#updatedAt"] = "updatedAt";

    const updatedItem = await updateItemInDynamoDB({
      table: TABLE_NAME.BLOGS,
      Key: { id },
      UpdateExpression: `SET ${updateFields.join(", ")}`,
      ExpressionAttributeValues: attributeValues,
      ExpressionAttributeNames: attributeNames,
      ConditionExpression: "attribute_exists(id)",
    });

    return sendResponse(
      200,
      "Blog updated successfully",
      updatedItem.Attributes
    );
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
