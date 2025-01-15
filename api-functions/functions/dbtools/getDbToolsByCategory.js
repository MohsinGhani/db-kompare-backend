import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchDbToolCategoryDetail } from "../common/fetchDbToolCategoryDetail.js";

export const handler = async (event) => {
  const { category_id } = event.pathParameters || {};

  // Check if category_id is provided
  if (!category_id) {
    return sendResponse(400, "Category id is required", null);
  }

  try {
    // Fetch db tools by category_id
    const data = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.DB_TOOLS,
      IndexName: "byCategoryAndStatus",
      KeyConditionExpression: "category_id = :category_id",
      ExpressionAttributeValues: {
        ":category_id": category_id,
      },
    });

    // Fetch category details
    const categoryDetails = await fetchDbToolCategoryDetail(category_id);

    // Transform data to include category details
    const transformData = data.map((item) => ({
      ...item,
      category_name: categoryDetails?.name || null,
      category_description: categoryDetails?.description || null,
    }));

    return sendResponse(200, "Successfully fetched db tools", transformData);
  } catch (error) {
    console.error("Error fetching db tools:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
