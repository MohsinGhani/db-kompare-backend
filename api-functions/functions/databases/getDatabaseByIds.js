import { TABLE_NAME } from "../../helpers/constants.js";
import { getBatchItems } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { ids } = JSON.parse(event.body);

    // Validate IDs
    if (!ids || !Array.isArray(ids)) {
      return sendResponse(400, "An array of database IDs is required", null);
    }

    if (ids.length > 5) {
      return sendResponse(
        400,
        "You can request a maximum of 5 databases at a time.",
        null
      );
    }

    // Create Keys for batchGet
    const Keys = ids.map((id) => ({ id }));
    const data = await getBatchItems(TABLE_NAME.DATABASES, Keys);

    const databases = data.Responses[TABLE_NAME.DATABASES];

    // Check if any databases are found
    if (!databases || databases.length === 0) {
      return sendResponse(404, "No databases found for the provided IDs", null);
    }

    // Return success response with database details
    return sendResponse(200, "Databases details", databases);
  } catch (error) {
    console.error("Error fetching databases details:", error);
    return sendResponse(
      500,
      "Failed to fetch databases details",
      error.message
    );
  }
};
