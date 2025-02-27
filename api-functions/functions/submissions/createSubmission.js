// src/functions/createSubmission.js
import { createItemInDynamoDB } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { userId, executiontime, timetaken, query, queryStatus } = JSON.parse(
      event.body || "{}"
    );

    // Validate required fields
    if (!userId || !executiontime || !timetaken || !query || !queryStatus) {
      return sendResponse(400, "Missing required fields", null);
    }

    // Create the submission item
    const submissionItem = {
      id: uuidv4(),
      userId,
      executiontime,
      timetaken,
      query,
      queryStatus,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    // Insert the submission item into the SUBMISSIONS table
    await createItemInDynamoDB(
      submissionItem,
      TABLE_NAME.SUBMISSIONS,
      { "#id": "id" },
      "attribute_not_exists(#id)",
      false
    );

    return sendResponse(200, "Submission created successfully", submissionItem);
  } catch (error) {
    console.error("Error creating submission:", error);
    return sendResponse(500, "Error creating submission", error.message);
  }
};
