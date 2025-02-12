import { runQuery } from '../helpers/db-client.js';

export const queryDB = async (event) => {
  try {
    // 1. Parse incoming JSON from event.body
    const { userQuery, assignmentId } = JSON.parse(event.body);

    // 2. Fetch the correct query from 'assignments'
    const correctQueryRes = await runQuery(
      'SELECT correct_query FROM assignments WHERE assignment_id = $1',
      [assignmentId]
    );

    if (!correctQueryRes.length) {
      throw new Error('Assignment not found');
    }

    const correctQuery = correctQueryRes[0].correct_query;

    // 3. Execute both queries
    const correctResult = await runQuery(correctQuery);
    const userResult = await runQuery(userQuery);

    // 4. Compare results
    const isCorrect = JSON.stringify(correctResult) === JSON.stringify(userResult);

    // 5. Return result
    return {
      statusCode: 200,
      body: JSON.stringify({ isCorrect, userResult }),
    };
  } catch (error) {
    console.error('Lambda Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
