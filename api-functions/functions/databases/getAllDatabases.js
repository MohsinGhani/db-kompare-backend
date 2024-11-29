import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event, context, callback) => {
  console.log("Fetching all databases");

  try {
    // Use fetchAllItemByDynamodbIndex to get all databases
    const data = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.DATABASES, // Use the table name constant
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :statusVal",
      ExpressionAttributeValues: {
        ":statusVal": DATABASE_STATUS.ACTIVE, // Example: if you want to filter by active status
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    // Check if there are any items in the response and return them
    return sendResponse(200, "Successful", data);
  } catch (error) {
    console.error("Error fetching databases:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
