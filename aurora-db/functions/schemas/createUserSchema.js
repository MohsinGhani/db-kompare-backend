import { executeCommonQuery } from "../../db/index.js";

export const handler = async (event) => {
  // Construct the schema name (e.g., "user_123")
  const { userId } = JSON.parse(event.body || "{}");
  const schemaName = `user_${userId}`;

  try {
    // 1. Create the schema if it does not exist.
    await executeCommonQuery(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // 2. Create the 'users' table.
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50),
        role VARCHAR(50)
      );
    `;
    await executeCommonQuery(createUsersTableQuery);

    // 3. Create the 'posts' table with a foreign key reference to users.
    const createPostsTableQuery = `
      CREATE TABLE IF NOT EXISTS "${schemaName}".posts (
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

    return {
      message: `Schema ${schemaName}, tables, and sample data created successfully.`,
    };
  } catch (error) {
    console.error("Error creating schema, tables, or inserting data:", error);
    throw error;
  }
};
