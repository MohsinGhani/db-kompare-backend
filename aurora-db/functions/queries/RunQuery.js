// Lambda function code (Node.js)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

// We'll use lodash for deep equality and sorting
const _ = require("lodash");

exports.handler = async (event) => {
  // Expecting a JSON payload: { questionId: "Q1", userQuery: "SELECT * FROM ..."}
  const { questionId, userQuery } = JSON.parse(event.body);

  // 1. Execute the user's SQL query against Aurora Postgres using Prisma.
  let userResult;
  try {
    // $queryRawUnsafe is used here for demonstration; ensure you handle SQL injection risks!
    userResult = await prisma.$queryRawUnsafe(userQuery);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Error executing SQL query",
        details: error.message,
      }),
    };
  }

  // 2. Fetch the expected solution from DynamoDB.
  const params = {
    TableName: "SolutionTable", // Your DynamoDB solution table
    Key: { questionId },
  };

  let expectedSolution;
  try {
    const data = await docClient.get(params).promise();
    // Assume the item structure is { questionId: 'Q1', solution: [...] }
    expectedSolution = data.Item.solution;
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error fetching solution from DynamoDB",
        details: error.message,
      }),
    };
  }

  // 3. Normalize both outputs.
  // If the result is an array of rows, sort by all keys to remove order differences.
  const normalize = (data) => {
    if (Array.isArray(data) && data.length > 0) {
      // Sort based on all keys (assuming all rows have the same keys)
      const keys = Object.keys(data[0]);
      return _.sortBy(data, keys);
    }
    return data;
  };

  const normalizedUserResult = normalize(userResult);
  const normalizedExpected = normalize(expectedSolution);

  // 4. Compare the normalized results using deep equality.
  const isCorrect = _.isEqual(normalizedUserResult, normalizedExpected);

  // 5. Return the result.
  return {
    statusCode: 200,
    body: JSON.stringify({
      correct: isCorrect,
      userOutput: normalizedUserResult,
      expectedOutput: normalizedExpected,
    }),
  };
};
