import { sendResponse, updateItemInDynamoDB } from "../../helpers/helpers.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event, context, callback) => {
  let params = JSON.parse(event.body);

  if (!params.id || (!params.comment && params.rating === undefined)) {
    return sendResponse(
      400,
      "Bad Request: Missing comment ID, comment, or rating",
      false
    );
  }

  if (params.comment && params.comment.length > 1000) {
    return sendResponse(
      400,
      "Comment exceeds maximum length of 1000 characters",
      null
    );
  }

  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  let removeExpressions = [];

  if (params.comment !== undefined) {
    if (params.comment === "") {
      // If comment is an empty string, add to REMOVE expressions
      removeExpressions.push("#comment");
      expressionAttributeNames["#comment"] = "comment";
    } else {
      // Otherwise, update the comment
      updateExpressions.push("#comment = :comment");
      expressionAttributeNames["#comment"] = "comment";
      expressionAttributeValues[":comment"] = params.comment;
    }
  }

  if (params.rating !== undefined) {
    updateExpressions.push("#rating = :rating");
    expressionAttributeNames["#rating"] = "rating";
    expressionAttributeValues[":rating"] = params.rating;
  }

  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  let updateExpression = "";
  if (updateExpressions.length > 0) {
    updateExpression += `SET ${updateExpressions.join(", ")}`;
  }
  if (removeExpressions.length > 0) {
    if (updateExpression) {
      updateExpression += " ";
    }
    updateExpression += `REMOVE ${removeExpressions.join(", ")}`;
  }

  const updateParams = {
    table: TABLE_NAME.COMMENTS,
    Key: { id: params.id },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: "attribute_exists(id)",
  };

  try {
    await updateItemInDynamoDB(updateParams);
    return sendResponse(200, "Comment Updated Successfully", true);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
