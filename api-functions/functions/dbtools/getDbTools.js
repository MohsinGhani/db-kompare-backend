import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, DB_TOOL_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchDbToolCategoryDetail } from "../common/fetchDbToolCategoryDetail.js";

export const handler = async (event) => {
  try {
    // Fetch databases based on the status
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

    const filteredData = data.filter((db) => db.ui_display !== "NO");

    // Transform data by replacing category_id with category details
    const transformData = await Promise.all(
      filteredData.map(async (item) => {
        const categoryDetails = await fetchDbToolCategoryDetail(
          item?.category_id
        );
        return {
          ...item,
          category_name: categoryDetails?.name || "",
          category_description: categoryDetails?.description || "",
        };
      })
    );

    return sendResponse(200, "Successfully fetched db tools", transformData);
  } catch (error) {
    console.error("Error fetching db tools:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
