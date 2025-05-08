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

  // function genericNormalize(data) {
  //   if (!Array.isArray(data)) return data;

  //   // Modified regex to match full ISO strings (if you ever get strings)
  //   const isoDateRegex =
  //     /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/;

  //   return data
  //     .map((obj) => {
  //       const normalized = {};
  //       Object.keys(obj)
  //         .sort()
  //         .forEach((key) => {
  //           let value = obj[key];

  //           // If the value is a Date object, convert it using moment.
  //           if (value instanceof Date) {
  //             value = formatDateLocal(value);
  //           } else if (typeof value === "string") {
  //             const trimmedValue = value.trim();
  //             // If the string matches an ISO date, convert it.
  //             if (isoDateRegex.test(trimmedValue)) {
  //               // Check if there's a time portion
  //               const match = isoDateRegex.exec(trimmedValue);
  //               if (match[2]) {
  //                 value = formatDateLocal(new Date(trimmedValue));
  //               } else {
  //                 value = trimmedValue;
  //               }
  //             }
  //             // Convert numeric strings to numbers.
  //             else if (/^\d+$/.test(trimmedValue)) {
  //               value = Number(trimmedValue);
  //             }
  //           }
  //           normalized[key] = value;
  //         });
  //       return normalized;
  //     })
  //     .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  // }
  function tryParsePgDate(s) {
    // Build a single RegExp (no /x flag) that matches:
    //  - YYYY-MM-DD
    //  - YYYY-MM-DD HH:mm:ss[.ffffff][±HH[:MM]]
    //  - YYYY-MM-DDTHH:mm:ss[.ffffff][±HH[:MM]]
    const pgRegex =
      /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)([+-]\d{2}(?::?\d{2})?)?)?$/;

    const m = pgRegex.exec(s);
    if (!m) return null;

    const [, datePart, timePart, rawOffset] = m;
    let iso = datePart;

    if (timePart) {
      iso += "T" + timePart;
      if (rawOffset) {
        let offset = rawOffset;
        // normalize "+HH" → "+HH:00", "+HHMM" → "+HH:MM"
        if (!offset.includes(":")) {
          if (/^[+-]\d{2}$/.test(offset)) {
            offset += ":00";
          } else if (/^[+-]\d{4}$/.test(offset)) {
            offset = offset.slice(0, 3) + ":" + offset.slice(3);
          }
        }
        iso += offset;
      }
    }

    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Normalize any value into one of: Date, Number, Boolean, String, Array, or Object.
   */
  function normalizeValue(val) {
    if (val instanceof Date) return val;
    if (typeof val === "number" || typeof val === "boolean") return val;

    if (Array.isArray(val)) {
      return val.map(normalizeValue);
    }

    if (val && typeof val === "object") {
      const out = {};
      Object.keys(val)
        .sort()
        .forEach((k) => {
          out[k] = normalizeValue(val[k]);
        });
      return out;
    }

    const s = String(val).trim();

    if (/^(true|false)$/i.test(s)) {
      return s.toLowerCase() === "true";
    }

    // strip commas/spaces for thousands separators, allow decimals & exponents
    const numClean = s.replace(/[, ]/g, "");
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(numClean)) {
      return Number(numClean);
    }

    const pgDate = tryParsePgDate(s);
    if (pgDate) {
      return pgDate;
    }

    // fallback to any other Date.parse–able format
    const ts = Date.parse(s);
    if (!isNaN(ts)) {
      return new Date(ts);
    }

    return s;
  }

  /**
   * Normalize an array of objects: sort keys, normalize every value, then sort the array.
   */
  function genericNormalize(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr
      .map((obj) => {
        const out = {};
        Object.keys(obj)
          .sort()
          .forEach((key) => {
            out[key] = normalizeValue(obj[key]);
          });
        return out;
      })
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  const normalizedUserResult = genericNormalize(resultObj.data);
  const normalizedExpected = genericNormalize(
    questionResult?.Item?.solutionData
  );

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
