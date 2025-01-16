import { TABLE_NAME } from "../../helpers/constants.js";
import { getBatchItems } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchDbToolCategoryDetail } from "../common/fetchDbToolCategoryDetail.js";

export const handler = async (event) => {
  try {
    const { ids } = JSON.parse(event.body);

    // Validate IDs
    if (!ids || !Array.isArray(ids)) {
      return sendResponse(400, "An array of DB Tool IDs is required", null);
    }

    // Create Keys for batchGet
    const Keys = ids.map((id) => ({ id }));
    const data = await getBatchItems(TABLE_NAME.DB_TOOLS, Keys);

    const db_tools = data.Responses[TABLE_NAME.DB_TOOLS];

    // Check if any db tool are found
    if (!db_tools || db_tools.length === 0) {
      return sendResponse(404, "No db tool found for the provided IDs", null);
    }

    // Transform data by replacing category_id with category details
    const transformData = await Promise.all(
      db_tools.map(async (item) => {
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
    // Return success response with DB Tool details
    return sendResponse(200, "db tools details", transformData);
  } catch (error) {
    console.error("Error fetching db tools details:", error);
    return sendResponse(500, "Failed to fetch db tools details", error.message);
  }
};
