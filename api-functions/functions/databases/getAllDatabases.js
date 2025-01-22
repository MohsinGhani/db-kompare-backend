import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

const fetchStatus = async (status) => {
  // If status is ALL, we need to fetch both ACTIVE and INACTIVE
  if (status === DATABASE_STATUS.ALL) {
    const [activeDatabases, inactiveDatabases] = await Promise.all([
      fetchStatus(DATABASE_STATUS.ACTIVE),
      fetchStatus(DATABASE_STATUS.INACTIVE),
    ]);
    return [...activeDatabases, ...inactiveDatabases];
  }

  // If status is not ALL, we fetch based on the specific status
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
  console.log("Fetching databases with status:", event.status);

  try {
    // Check if the status passed in the event is valid or use ALL by default
    const status = event.queryStringParameters?.status || DATABASE_STATUS.ALL;

    // Validate status
    if (
      ![
        DATABASE_STATUS.ACTIVE,
        DATABASE_STATUS.INACTIVE,
        DATABASE_STATUS.ALL,
      ].includes(status)
    ) {
      return sendResponse(
        400,
        "Bad Request",
        "Invalid status value. Accepted values are 'ACTIVE', 'INACTIVE', or 'ALL'."
      );
    }
    // Fetch databases based on the status
    const data = await fetchStatus(status);
    
    // Filter out objects that explicitly contain "ui_display": "NO"
    const filteredData = data.filter((db) => db.ui_display !== "NO");

    return sendResponse(200, "Successfully fetched databases", filteredData);
  } catch (error) {
    console.error("Error fetching databases:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
