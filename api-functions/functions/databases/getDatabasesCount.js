import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event, context, callback) => {
  console.log("Fetching count of active databases");

  try {
    // Use fetchAllItemByDynamodbIndex to get the count of active databases
    const data = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.DATABASES, // Use the table name constant
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :statusVal", // Filter by status
      ExpressionAttributeValues: {
        ":statusVal": DATABASE_STATUS.ACTIVE, // Example: filter by active status
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
      CountOnly: true,
    });

    // Return the count of items
    return sendResponse(200, "Successful", { count: data }); // data.Count will hold the item count
  } catch (error) {
    console.error("Error fetching count of databases:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
