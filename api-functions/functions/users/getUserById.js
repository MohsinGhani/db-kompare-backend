import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { id } = event.queryStringParameters || {};

    if (!id) {
      return sendResponse(400, "User id is required", null);
    }
    const key = { id };
    const data = await getItem(TABLE_NAME.USERS, key);

    if (!data.Item) {
      return sendResponse(404, `User with id ${id} not found.`, null);
    }

    return sendResponse(200, "User details", data.Item);
  } catch (error) {
    console.error("Error fetching user details:", error);
    return sendResponse(500, "Failed to fetch user details", error.message);
  }
};
