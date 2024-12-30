import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

const fetchStatus = async (status) => {
  return await fetchAllItemByDynamodbIndex({
    TableName: TABLE_NAME.DATABASES,
    IndexName: "byStatus",
    KeyConditionExpression: "#status = :status",
    ExpressionAttributeValues: {
      ":status": status,
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  });
};

export const handler = async (event, context, callback) => {
  console.log("Fetching all databases with ACTIVE or INACTIVE status");

  try {
    // Use Promise.all to fetch both ACTIVE and INACTIVE statuses in parallel
    const [activeDatabases, inactiveDatabases] = await Promise.all([
      fetchStatus(DATABASE_STATUS.ACTIVE),
      fetchStatus(DATABASE_STATUS.INACTIVE),
    ]);

    // Merge results
    const data = [...activeDatabases, ...inactiveDatabases];

    return sendResponse(200, "Successfully fetch databases", data);
  } catch (error) {
    console.error("Error fetching databases:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
