import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env if you want

// Module-scoped variable to hold the pool across Lambda invocations
let pool;

/**
 * Returns a singleton Pool instance
 */
export const getDBPool = () => {
  if (!pool) {
    console.log("Initializing PostgreSQL pool...");
    pool = new Pool({
      host: process.env.PG_HOST,
      user: process.env.PG_USER,
      database: process.env.PG_DATABASE,
      port: process.env.PG_PORT,
      password: process.env.PG_PASSWORD,
      ssl: { rejectUnauthorized: false }, // or as needed
      max: 10,             // Limit # of connections in pool
      idleTimeoutMillis: 30000,  // Close idle clients after 30s
      connectionTimeoutMillis: 2000 // Return an error after 2s if can't connect
    });
  }
  return pool;
};

/**
 * Reusable function to run queries using the pool
 */
export const runQuery = async (sql, params = []) => {
  const pool = getDBPool();  
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows; // return rows or the entire result as needed
  } catch (error) {
    console.error("DB Query Error:", error);
    throw error;
  } finally {
    client.release(); // release client back to the pool
  }
};
