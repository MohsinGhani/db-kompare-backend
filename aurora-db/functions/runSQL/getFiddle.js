import { TABLE_NAME } from "../../helpers/constants.js";
import {
  fetchAllItemByDynamodbIndex,
  getItem,
} from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";
import { executeUserQuery } from "../../db/index.js";

export const handler = async (event) => {
  try {
    // Assume the fiddle id is passed as a path parameter.
    const { id } = event.pathParameters || {};
    const { userId } = event.queryStringParameters || {};

    let fiddle;
    if (id === "latest" && userId) {
      const params = {
        TableName: TABLE_NAME.FIDDLES,
        IndexName: "byOwnerId",
        KeyConditionExpression: "ownerId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      };

      // Query and get the most recent fiddle
      const fiddles = await fetchAllItemByDynamodbIndex(params);
      fiddle = fiddles.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    } else {
      const result = await getItem(TABLE_NAME.FIDDLES, { id });
      if (!result.Item) {
        return sendResponse(404, "Fiddle not found", null);
      }
      fiddle = result.Item;
    }

    // If tables are defined, fetch data from Postgres and filter missing ones
    if (Array.isArray(fiddle.tables) && fiddle.tables.length > 0) {
      const ownerId = fiddle.ownerId || "common";
      console.log(`Fetching tables for ownerId: ${ownerId}`);
      // Attempt to query each table; null if missing
      const tableDataEntries = await Promise.all(
        fiddle.tables.map(async (table) => {
          const tableName = table?.name;
          if (!tableName) return null;

          const sql = `SELECT * FROM "${tableName}" LIMIT 500;`;

          try {
            const { columns, rows } = await executeUserQuery(ownerId, sql);

            console.log("columns", columns);
            console.log("rows", rows);

            const header = columns.reduce((h, col) => {
              h[col] = col;
              return h;
            }, {});
            return [tableName, [header, ...rows]];
          } catch (err) {
            const msg = err.message || "";
            if (msg.includes("does not exist") || msg.includes("relation")) {
              console.warn(
                `Postgres table "${tableName}" not found, skipping.`
              );
              return null;
            }
            throw err;
          }
        })
      );

      // Remove missing table entries
      const validEntries = tableDataEntries.filter((entry) => entry !== null);

      // Build dataSample map
      fiddle.dataSample = Object.fromEntries(validEntries);

      // Also filter the original tables list to only include existing ones
      const validTableNames = validEntries.map(([name]) => name);
      fiddle.tables = fiddle.tables.filter((t) =>
        validTableNames.includes(t.name)
      );
    }

    return sendResponse(200, "Fiddle fetched successfully", fiddle);
  } catch (error) {
    console.error("Error fetching fiddle:", error);
    return sendResponse(500, error.message || "Internal server error", null);
  }
};
