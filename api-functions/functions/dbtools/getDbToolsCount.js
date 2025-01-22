import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { DB_TOOL_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async () => {
  console.log("Fetching count of DB TOOLS with status:");
  try {
    // Fetch database count based on the status
    const data = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.DB_TOOLS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": DB_TOOL_STATUS.ACTIVE,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    // Filter out objects that explicitly contain "ui_display": "NO"
    const count = data.filter((db) => db.ui_display !== "NO").length || 0;

    return sendResponse(200, "Successfully fetched DB TOOLS count", { count });
  } catch (error) {
    console.error("Error fetching DB TOOLS count:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
