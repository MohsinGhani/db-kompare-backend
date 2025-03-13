import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem } from "../../helpers/dynamodb.js";

export const fetchUserById = async (id) => {
  const key = {
    id,
  };
  try {
    const result = await getItem(TABLE_NAME.USERS, key);
    if (result.Item) {
      return result.Item;
    }
    return "Unknown"; // Fallback if the user  is not found
  } catch (error) {
    console.error(`Error fetching user for ID ${id}:`, error);
    throw error;
  }
};
