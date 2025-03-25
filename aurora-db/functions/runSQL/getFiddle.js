import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem } from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";
import { executeUserQuery } from "../../db/index.js";

export const handler = async (event) => {
  try {
    // Assume the fiddle id is passed as a path parameter.
    const { id } = event.pathParameters || {};

    const result = await getItem(TABLE_NAME.FIDDLES, { id });

    if (!result.Item) {
      return sendResponse(404, "Fiddle not found", null);
    }

    // For each table name listed in the fiddle's `tables` array,
    // run a query on Postgres to fetch its data.
    if (result.Item.tables && Array.isArray(result.Item.tables)) {
      const userId = result.Item.ownerId;
      const tableDataEntries = await Promise.all(
        result.Item.tables.map(async (tableName) => {
          // Construct a query for the table.
          // Adjust the schema if needed (e.g., use "public" or your specific schema)
          const query = `SELECT * FROM "${tableName}";`;

          const queryResult = await executeUserQuery(userId, query);
          // Assume queryResult.rows holds the rows returned by Postgres.
          return [tableName, queryResult.rows];
        })
      );
      // Set dataSample as an object mapping each table name to its fetched rows.
      result.Item.dataSample = Object.fromEntries(tableDataEntries);
    }

    return sendResponse(200, "Fiddle fetched successfully", result.Item);
  } catch (error) {
    console.error("Error fetching fiddle:", error);
    return sendResponse(500, error, null);
  }
};
