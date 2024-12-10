import { sendResponse, updateItemInDynamoDB } from "../../helpers/helpers.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event, context, callback) => {
  let params = JSON.parse(event.body);

  if (!params.id || !params.comment) {
    return sendResponse(
      400,
      "Bad Request: Missing comment ID or comment",
      false
    );
  }

  const updateParams = {
    table: TABLE_NAME.COMMENTS,
    Key: { id: params.id },
    UpdateExpression: "SET #comment = :comment, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#comment": "comment",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":comment": params.comment,
      ":updatedAt": new Date().toISOString(),
    },
    ConditionExpression: "attribute_exists(#comment)",
  };

  try {
    await updateItemInDynamoDB(updateParams);
    return sendResponse(200, "Comment Updated Successfully", true);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
