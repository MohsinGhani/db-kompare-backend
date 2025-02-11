require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  database: process.env.PG_DATABASE,
  port: process.env.PG_PORT,
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

module.exports.queryDB = async (event) => {
  let body;

  // Parse JSON body correctly
  if (event.body) {
    try {
      body = JSON.parse(event.body); // ✅ Parse the request body
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON format in request body" }),
      };
    }
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  const { userQuery, assignmentId } = body; // ✅ Extract values after parsing
  console.log("Received Payload:", userQuery, assignmentId); // Debugging log

  const client = await pool.connect();

  try {
      // Fetch the correct query from the database
      const correctQueryRes = await client.query(
          'SELECT correct_query FROM assignments WHERE assignment_id = $1',
          [assignmentId]
      );

      
      if (correctQueryRes.rows.length === 0) {
          throw new Error('Assignment not found');
      }

      const correctQuery = correctQueryRes.rows[0].correct_query;

      // Run the correct query
      const correctResult = await client.query(correctQuery);
      const userResult = await client.query(userQuery);

      // Compare results
      const isCorrect = JSON.stringify(correctResult.rows) === JSON.stringify(userResult.rows);

      await client.end();

      return {
          statusCode: 200,
          body: JSON.stringify({
              isCorrect,
              userResult: userResult.rows
          })
      };
  } catch (error) {
      await client.end();
      return {
          statusCode: 400,
          body: JSON.stringify({ error: error.message })
      };
  }
};
