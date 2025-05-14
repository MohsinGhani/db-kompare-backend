import pkg from "pg";
const { Pool } = pkg;

// Create a pool for the read-only connection
const readonlyPool = new Pool({
  connectionString: process.env.DATABASE_URL_READONLY,
  ssl: {
    rejectUnauthorized: false, // disable verification
  },
});

// Create a pool for the common (read-write) connection
const commonPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // disable verification
  },
});

// Function to execute a query on the read-only schema
export async function executeReadOnlyQuery(query, params = []) {
  const client = await readonlyPool.connect();
  try {
    const startTime = Date.now();
    const result = await client.query(query, params);
    const executionTime = Date.now() - startTime;
    const columns = result.fields?.map((field) => field.name) || [];
    return { columns, rows: result.rows, executionTime };
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}

// Function to execute a query on the common schema
export async function executeCommonQuery(query, params = []) {
  const client = await commonPool.connect();
  try {
    const startTime = Date.now();
    const result = await client.query(query, params);
    const executionTime = Date.now() - startTime;
    const columns = result.fields?.map((field) => field.name) || [];
    return { columns, rows: result.rows, executionTime };
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}

export async function executeUserQuery(userId, query, params = []) {
  const client = await commonPool.connect();
  let schema;

  if (userId !== "common" && userId) {
    schema = `"user_${userId}"`;
    console.log(`Using user-specific schema: ${schema}`);
  } else if (userId === "common") {
    schema = `"common_schema"`;
    console.log("Using common schema");
  } else {
    throw new Error("Invalid userId");
  }

  try {
    await client.query("BEGIN");
    // Set the search_path to the user-specific schema, e.g., user_123
    await client.query(`SET LOCAL search_path TO ${schema}`);

    const startTime = Date.now();
    const result = await client.query(query, params);
    const executionTime = Date.now() - startTime;
    await client.query("COMMIT");

    // Extract column names
    const columns = result.fields?.map((field) => field.name) || [];
    return { columns, rows: result.rows, executionTime };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
