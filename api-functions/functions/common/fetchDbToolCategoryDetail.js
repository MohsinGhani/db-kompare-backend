import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem } from "../../helpers/dynamodb.js";

// Get database name
export const fetchDbToolCategoryDetail = async (id) => {
  const key = {
    id,
  };
  try {
    const result = await getItem(TABLE_NAME.DB_TOOL_CATEGORIES, key);
    if (result.Item) {
      return result.Item;
    }
    return "DB Tool"; // Fallback if the database name is not found
  } catch (error) {
    console.error(`Error fetching db tool for ID ${id}:`, error);
    throw error;
  }
};
