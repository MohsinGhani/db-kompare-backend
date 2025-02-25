import prismaReadOnly from "../../db/prismaReadOnly.js";
import prismaCommonClient from "../../db/prismaCommonClient.js";
import { getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Expect the request body to include:
    // { questionId: "...", query: "SELECT * FROM table WHERE id = ?", queryParams: [value] }
    const { questionId, query, queryParams } = JSON.parse(event.body || "{}");
    console.log(questionId, query);
    if (!questionId || !query) {
      return sendResponse(400, "Missing questionId or query", null);
    }

    const tableName = TABLE_NAME.QUESTIONS;
    const questionResult = await getItem(tableName, { id: questionId });
    console.log("question", questionResult);
    let client;

    if (questionResult?.Item.access?.includes("read-only")) {
      client = prismaReadOnly;
    } else {
      client = prismaCommonClient;
    }

    // Execute the provided query using Prisma's parameterized $queryRaw.
    // The query string should use placeholders (e.g., ?)
    // and queryParams is an array containing the values for these placeholders.
    const result = await client.$queryRawUnsafe(query);

    return sendResponse(200, "Query executed successfully", result);
  } catch (error) {
    console.error("Error executing query:", error);
    return sendResponse(500, "Internal server error", { error: error.message });
  }
};
