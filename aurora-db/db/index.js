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
  connectionString: process.env.DATABASE_URL_COMMON,
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
    return { rows: result.rows, executionTime };
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
    return { rows: result.rows, executionTime };
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}
