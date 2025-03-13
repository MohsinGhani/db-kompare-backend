import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

const fetchDatabaseCount = async (status) => {
  // If status is ALL, we need to count both ACTIVE and INACTIVE
  if (status === DATABASE_STATUS.ALL) {
    const [activeCount, inactiveCount] = await Promise.all([
      fetchDatabaseCount(DATABASE_STATUS.ACTIVE),
      fetchDatabaseCount(DATABASE_STATUS.INACTIVE),
    ]);
    return activeCount + inactiveCount;
  }

  // Fetch items based on the specific status
  const result = await fetchAllItemByDynamodbIndex({
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

  // Filter out items that contain ui_display: "NO"
  // const filteredData = result.filter((item) => item.ui_display !== "NO");

  // Return the count of filtered items
  return result.length || 0;
};

export const handler = async (event, context, callback) => {
  console.log("Fetching count of databases with status:", event.status);

  try {
    // Get status from query parameters or default to ALL
    const status =
      event.queryStringParameters?.status || DATABASE_STATUS.ACTIVE;

    // Validate the status input
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
    // Fetch database count based on the status
    const count = await fetchDatabaseCount(status);

    return sendResponse(200, "Successfully fetched database count", { count });
  } catch (error) {
    console.error("Error fetching database count:", error.message);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
