import prismaReadOnly from "../../db/prismaReadOnly.js";
import prismaCommonClient from "../../db/prismaCommonClient.js";
import { getItem } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
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

    // Determine which Prisma client to use based on access rights
    const client = questionResult?.Item?.access?.includes("read-only")
      ? prismaReadOnly
      : prismaCommonClient;

    // Execute the user query using Prisma's raw query (be cautious of SQL injection)
    const result = await client.$queryRawUnsafe(query);
    const safeResult = safeSerialize(result);

    return sendResponse(200, "Query executed successfully", safeResult);
  } catch (error) {
    console.error("Error executing query:", error);
    const match = error.message.match(/Message:\s*`([^`]+)`/);
    const partialMessage = match ? match[1] : error.message;
    return sendResponse(500, { error: partialMessage }, null);
  }
};
