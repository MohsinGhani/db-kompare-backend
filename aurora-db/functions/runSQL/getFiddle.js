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
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      };

      // Query the DynamoDB table using your helper function
      const fiddles = await fetchAllItemByDynamodbIndex(params);
      // Sort fiddles by updatedAt in descending order.
      fiddle = fiddles.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    } else {
      const result = await getItem(TABLE_NAME.FIDDLES, { id });
      if (!result.Item) {
        return sendResponse(404, "Fiddle not found", null);
      }
      fiddle = result.Item;
    }

    // For each table name listed in the fiddle's `tables` array,
    // run a query on Postgres to fetch its data.
    if (fiddle.tables && Array.isArray(fiddle.tables)) {
      const userId = fiddle.ownerId;
      const tableDataEntries = await Promise.all(
        fiddle.tables.map(async (tableName) => {
          // Construct a query to fetch all rows from the table.
          const query = `SELECT * FROM "${tableName}";`;
          const queryResult = await executeUserQuery(userId, query);

          // Destructure the column names and rows from the query result.
          const { columns, rows } = queryResult;

          // Create a header object where each key and value is the column name.
          const headerRow = columns.reduce((header, col) => {
            header[col] = col;
            return header;
          }, {});

          // Prepend the headerRow to the array of rows.
          const tableData = [headerRow, ...rows];

          // Return an entry mapping the table name to its tableData.
          return [tableName, tableData];
        })
      );

      // Construct an object mapping each table name to its data sample.
      fiddle.dataSample = Object.fromEntries(tableDataEntries);
    }

    return sendResponse(200, "Fiddle fetched successfully", fiddle);
  } catch (error) {
    console.error("Error fetching fiddle:", error);
    return sendResponse(500, error, null);
  }
};
