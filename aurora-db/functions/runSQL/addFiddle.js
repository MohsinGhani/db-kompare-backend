import { TABLE_NAME } from "../../helpers/constants.js";
import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";
import { v4 as uuidv4 } from "uuid";

export const handler = async (event) => {
  try {
    // Parse the incoming request body
    const body = JSON.parse(event.body);
    const { name, ownerId, databaseType, query, tables, dbStructure } = body;

    // Generate a unique id and timestamp for the fiddle
    const id = uuidv4();
    const timestamp = getTimestamp();

    // Build the fiddle object.
    // Note: 'tables' is an array of table names. The actual dataSample will be generated later during retrieval.
    const fiddle = {
      id,
      name: name || "Example RUN",
      ownerId,
      databaseType: databaseType || "postgres",
      dbStructure:
        dbStructure ||
        `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50),
  role VARCHAR(50)
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(50),
  body TEXT,
  user_id INTEGER,
  status VARCHAR(50),
  CONSTRAINT fk_user FOREIGN KEY(user_id)
    REFERENCES users(id)
);`,
      query: query || "SELECT * FROM users;",
      tables: tables || [
        { name: "users", createdAt: getTimestamp() },
        { name: "posts", createdAt: getTimestamp() },
      ],
      dataSample: null, // This will be generated by running queries for each table on retrieval
      queryResult: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const data = await createItemInDynamoDB(
      fiddle,
      TABLE_NAME.FIDDLES,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );
    console.log("data", data);

    return sendResponse(200, "Fiddle added successfully", true);
  } catch (error) {
    return sendResponse(500, error, null);
  }
};
