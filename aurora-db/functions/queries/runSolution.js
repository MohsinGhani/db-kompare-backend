import { TABLE_NAME } from "../../helpers/constants.js";
import { executeReadOnlyQuery, executeCommonQuery } from "../../db/index.js";
import { getItem } from "../../helpers/dynamodb.js";
import { safeSerialize, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { questionId, query } = JSON.parse(event.body || "{}");

    if (!questionId || !query) {
      return sendResponse(400, "Missing questionId or query", null);
    }

    // Fetch question details from DynamoDB
    const questionResult = await getItem(TABLE_NAME.QUESTIONS, {
      id: questionId,
    });

    // Determine which query function to use based on access rights
    const runQuery = questionResult?.Item?.access?.includes("read-only")
      ? executeReadOnlyQuery
      : executeCommonQuery;

    // Execute the user's query directly using the pg client.
    // This function returns an object with { rows, executionTime }
    const result = await runQuery(query);

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
