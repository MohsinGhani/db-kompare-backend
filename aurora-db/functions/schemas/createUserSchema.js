import { executeAdminQuery, executeCommonQuery } from "../../db/index.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  // Construct the schema name (e.g., "user_123")
  const { userId } = JSON.parse(event.body || "{}");
  const schemaName = `user_${userId}`;

  const admin_role = process.env.PG_USER;
  const common_role = process.env.PG_COMMON_USER;

  try {
    // 1. Create the schema if it does not exist.
    await executeAdminQuery(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    await executeAdminQuery(`
      GRANT USAGE, CREATE
        ON SCHEMA "${schemaName}"
        TO "${common_role}";

      GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
        ON ALL TABLES IN SCHEMA "${schemaName}"
        TO "${common_role}";

      GRANT USAGE
        ON ALL SEQUENCES IN SCHEMA "${schemaName}"
        TO "${common_role}";

      ALTER DEFAULT PRIVILEGES
        FOR ROLE "${admin_role}"
        IN SCHEMA "${schemaName}"
        GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
          ON TABLES
          TO "${common_role}";

      ALTER DEFAULT PRIVILEGES
        FOR ROLE "${admin_role}"
        IN SCHEMA "${schemaName}"
        GRANT USAGE
          ON SEQUENCES
          TO "${common_role}";
    `);

    // 2. Create the 'users' table.
    const createUsersTableQuery = `
      CREATE TABLE "${schemaName}".users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50),
        role VARCHAR(50)
      );
    `;
    await executeCommonQuery(createUsersTableQuery);

    // 3. Create the 'posts' table with a foreign key reference to users.
    const createPostsTableQuery = `
      CREATE TABLE "${schemaName}".posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(50),
        body TEXT,
        user_id INTEGER,
        status VARCHAR(50),
        CONSTRAINT fk_user FOREIGN KEY(user_id)
          REFERENCES "${schemaName}".users(id)
      );
    `;
    await executeCommonQuery(createPostsTableQuery);

    // 4. Insert sample data into the 'users' table.
    const insertUsersDataQuery = `
      INSERT INTO "${schemaName}".users (username, role)
      VALUES 
        ('alice', 'admin'),
        ('bob', 'user');
    `;
    await executeCommonQuery(insertUsersDataQuery);

    // 5. Insert sample data into the 'posts' table.
    const insertPostsDataQuery = `
      INSERT INTO "${schemaName}".posts (title, body, user_id, status)
      VALUES 
        ('Hello World', 'This is the content of the post', 1, 'published');
    `;
    await executeCommonQuery(insertPostsDataQuery);

    return sendResponse(200, "Schema and tables created successfully.", true);
  } catch (error) {
    console.log("Error creating schema or tables:", error);
    sendResponse(
      500,
      "Error creating schema, tables, or inserting data.",
      null
    );
  }
};
