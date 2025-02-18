import { sendResponse } from "../../helpers/helpers.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

export const handler = async () => {
  try {
    const status = "ACTIVE"; // Change this as needed

    const tags = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.TAGS,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": status,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    return sendResponse(200, "Tags fetched successfully", tags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
