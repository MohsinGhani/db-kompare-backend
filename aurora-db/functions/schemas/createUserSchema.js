import prismaReadOnly from "../../db/prismaReadOnly.js";

export const handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const { userId } = body;
  console.log("userId", userId);

  try {
    const schemaName = `user_${userId}`;
    console.log("Schema Name", schemaName);

    // Step 1: Create the schema (if it doesn't exist)
    await prismaReadOnly.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}";`
    );

    // Step 2: Check if the "products" table exists before creating it
    const productsTableExists = await prismaReadOnly.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = '${schemaName}'
        AND table_name = 'products'
      );
    `);
    console.log("productsTableExists", productsTableExists);

    if (!productsTableExists[0].exists) {
      await prismaReadOnly.$executeRawUnsafe(`
        CREATE TABLE "${schemaName}".products (
          id SERIAL PRIMARY KEY,
          name TEXT
        );
      `);
    }

    // Step 3: Check if the "users" table exists before creating it
    const usersTableExists = await prismaReadOnly.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = '${schemaName}'
        AND table_name = 'users'
      );
    `);

    if (!usersTableExists[0].exists) {
      await prismaReadOnly.$executeRawUnsafe(`
        CREATE TABLE "${schemaName}".users (
          id SERIAL PRIMARY KEY,
          email TEXT
        );
      `);
    }

    console.log(`Schema and tables created for user: ${userId}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Schema and tables created successfully",
      }),
    };
  } catch (error) {
    console.error("Error creating schema and tables:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create schema and tables" }),
    };
  } finally {
    await prismaReadOnly.$disconnect();
  }
};
