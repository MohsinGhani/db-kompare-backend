import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { DB_TOOL_STATUS, TABLE_NAME } from "../../helpers/constants.js";

export const fetchAlldbToolsCategories = async () => {
  try {
    const params = {
      TableName: TABLE_NAME.DB_TOOL_CATEGORIES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": DB_TOOL_STATUS.ACTIVE,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    };

    // Use the fetchAllItemByDynamodbIndex helper
    const result = await fetchAllItemByDynamodbIndex(params);

    return result;
  } catch (error) {
    console.log("Failed to get db tools categories", error.message);
  }
};
