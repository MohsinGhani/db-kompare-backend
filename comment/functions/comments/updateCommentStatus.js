import { sendResponse, updateItemInDynamoDB } from "../../helpers/helpers.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async (event, context, callback) => {
  let params = JSON.parse(event.body);

  if (!params.id) {
    return sendResponse(400, "Bad Request: Missing comment ID", false);
  }

  const updateParams = {
    table: TABLE_NAME.COMMENTS,
    Key: { id: params.id },
    UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#status": "status",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":status": params.status,
      ":updatedAt": new Date().toISOString(),
    },
    ConditionExpression: "attribute_exists(#status)",
  };

  try {
    await updateItemInDynamoDB(updateParams);
    return sendResponse(200, "Comment Status Updated Successfully", true);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
