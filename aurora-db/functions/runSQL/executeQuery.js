import { executeUserQuery } from "../../db/index.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { userId, query } = JSON.parse(event.body || "{}");

    if (!userId || !query) {
      return sendResponse(400, "Missing userId or query", null);
    }
    const result = await executeUserQuery(userId, query);

    const resultObj = {
      data: result.rows,
      executionTime: result.executionTime,
      columns: result.columns,
    };
    // Return the result and the execution time.
    return sendResponse(200, "Query executed successfully", resultObj);
  } catch (error) {
    console.error("Error executing query:", error);
    const match = error.message.match(/Message:\s*`([^`]+)`/);
    const partialMessage = match ? match[1] : error.message;
    return sendResponse(500, { error: partialMessage }, null);
  }
};
