import { executeCommonQuery } from "../../db/index.js";

export const handler = async (event) => {
  // Construct the schema name (e.g., "user_123")
  const { userId } = JSON.parse(event.body || "{}");
  const schemaName = `user_${userId}`;

  try {
    // Execute the query to create the schema if it does not exist.
    await executeCommonQuery(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    return { message: `Schema ${schemaName} created successfully.` };
  } catch (error) {
    console.error("Error creating schema:", error);
    throw error;
  }
};
