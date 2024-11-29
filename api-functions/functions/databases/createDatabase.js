import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event, context, callback) => {
  // Parse the incoming request body
  let params = JSON.parse(event.body);

  // Add a unique ID to the item
  params.id = uuidv4();
  params.status = DATABASE_STATUS.ACTIVE;

  console.log("Filtered and validated params:", JSON.stringify(params));

  try {
    await createItemInDynamoDB(
      params,
      TABLE_NAME.DATABASES,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );
    return sendResponse(200, "Database Created Successfully", true);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
