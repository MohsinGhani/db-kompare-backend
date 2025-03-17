import { TABLE_NAME } from "../../helpers/constants.js";
import { executeReadOnlyQuery, executeCommonQuery } from "../../db/index.js";
import { createItemInDynamoDB, getItem } from "../../helpers/dynamodb.js";
import {
  formatDateLocal,
  getTimestamp,
  safeSerialize,
  sendResponse,
} from "../../helpers/helpers.js";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";

export const handler = async (event) => {
  const { questionId, userQuery, timetaken, userId } = JSON.parse(event.body);

  if (!questionId || !userQuery) {
    return sendResponse(400, "Missing questionId or query", null);
  }

  // Fetch question details from DynamoDB
  let questionResult;
  try {
    questionResult = await getItem(TABLE_NAME.QUESTIONS, { id: questionId });
  } catch (error) {
    return sendResponse(500, "Error fetching question", error.message);
  }

  // Determine which pool function to use based on access rights
  const runQuery = questionResult?.Item?.access?.includes("read-only")
    ? executeReadOnlyQuery
    : executeCommonQuery;

  let queryResult;
  try {
    // Directly run the user's query without wrapping it
    const safeQuery = userQuery;
    queryResult = await runQuery(safeQuery);
  } catch (error) {
    console.error("Error executing query:", error);
    const match = error.message.match(/Message:\s*`([^`]+)`/);
    const partialMessage = match ? match[1] : error.message;
    return sendResponse(500, { error: partialMessage }, null);
  }

  // Our pool functions return an object with { rows, executionTime }
  // We'll build our result object accordingly.
  const resultObj = {
    data: queryResult.rows,
    executionTime: queryResult.executionTime,
  };

  // Fetch the expected solution from DynamoDB
  let expectedSolution;
  try {
    const data = await getItem(TABLE_NAME.SOLUTIONS, { questionId });
    // Assume the solution is stored in the 'solutionData' field
    expectedSolution = data.Item.solutionData;
  } catch (error) {
    console.error("Error getting solution:", error);
    return sendResponse(
      500,
      "Error fetching solution from DynamoDB",
      error.message
    );
  }
  function genericNormalize(data) {
    if (!Array.isArray(data)) return data;

    // Modified regex to match full ISO strings (if you ever get strings)
    const isoDateRegex =
      /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/;

    return data
      .map((obj) => {
        const normalized = {};
        Object.keys(obj)
          .sort()
          .forEach((key) => {
            let value = obj[key];

            // If the value is a Date object, convert it using moment.
            if (value instanceof Date) {
              value = formatDateLocal(value);
            } else if (typeof value === "string") {
              const trimmedValue = value.trim();
              // If the string matches an ISO date, convert it.
              if (isoDateRegex.test(trimmedValue)) {
                // Check if there's a time portion
                const match = isoDateRegex.exec(trimmedValue);
                if (match[2]) {
                  value = formatDateLocal(new Date(trimmedValue));
                } else {
                  value = trimmedValue;
                }
              }
              // Convert numeric strings to numbers.
              else if (/^\d+$/.test(trimmedValue)) {
                value = Number(trimmedValue);
              }
            }
            normalized[key] = value;
          });
        return normalized;
      })
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  const normalizedUserResult = genericNormalize(resultObj.data);
  const normalizedExpected = genericNormalize(expectedSolution);

  const isCorrect = _.isEqual(normalizedUserResult, normalizedExpected);

  // Create the submission item
  const submissionItem = {
    id: uuidv4(),
    userId,
    executiontime: resultObj.executionTime,
    timetaken,
    userQuery,
    queryStatus: isCorrect,
    submittedAt: getTimestamp(),
    questionId,
  };

  // Insert the submission item into the SUBMISSIONS table in DynamoDB
  await createItemInDynamoDB(
    submissionItem,
    TABLE_NAME.SUBMISSIONS,
    { "#id": "id" },
    "attribute_not_exists(#id)",
    false
  );

  const responseData = safeSerialize({
    correct: isCorrect,
    userOutput: resultObj.data,
    expectedOutput: normalizedExpected,
  });

  return sendResponse(200, "Query executed successfully", responseData);
};
