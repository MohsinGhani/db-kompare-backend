import {
  getYesterdayDate,
  getTodayDate,
  sendResponse,
  calculateStackOverflowPopularity,
} from "../../helpers/helpers.js";
import {
  TABLE_NAME,
  DATABASE_STATUS,
  RESOURCE_TYPE,
} from "../../helpers/constants.js";
import {
  getItemByQuery,
  fetchAllItemByDynamodbIndex,
  updateItemInDynamoDB,
} from "../../helpers/dynamodb.js";
import { getStackOverflowMetrics } from "../../services/stackOverflowService.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all databases for stackOverflowData...");

    // Fetch all active and inactive databases
    const databases = await fetchAllDatabases();

    if (!databases || databases.length === 0) {
      console.log("No databases found.");
      return sendResponse(404, "No databases found.", null);
    }

    console.log("Fetching tracking data...");
    const trackingData = await fetchTrackingData();

    const trackingItem = trackingData?.Items?.[0];

    // Get the list of databases that have already been processed
    const mergedDatabases = trackingItem?.merged_databases || [];

    // Separate unprocessed and processed databases
    const { unprocessedDatabases, alreadyProcessedDatabases } =
      categorizeDatabases(databases, mergedDatabases);

    console.log("Unprocessed databases:", unprocessedDatabases.length);
    console.log(
      "Already processed databases:",
      alreadyProcessedDatabases.length
    );

    // Process unprocessed databases in batches of 50
    const processedDatabaseIds = await processUnprocessedDatabases(
      unprocessedDatabases.slice(0, 50)
    );

    // Update the tracking table
    await updateTrackingTable(
      mergedDatabases,
      processedDatabaseIds,
      unprocessedDatabases
    );

    console.log("Tracking table updated successfully.");
    return sendResponse(
      200,
      "stackOverflowData metrics updated successfully",
      true
    );
  } catch (error) {
    console.error("Error updating stackOverflowData metrics:", error);
    return sendResponse(
      500,
      "Failed to update stackOverflowData metrics.",
      error.message
    );
  }
};

// Fetch all active and inactive databases
const fetchAllDatabases = async () => {
  const [activeDatabases, inactiveDatabases] = await Promise.all([
    fetchDatabasesByStatus(DATABASE_STATUS.ACTIVE),
    fetchDatabasesByStatus(DATABASE_STATUS.INACTIVE),
  ]);

  return [...(activeDatabases || []), ...(inactiveDatabases || [])].sort(
    (a, b) =>
      a.status === DATABASE_STATUS.ACTIVE &&
      b.status === DATABASE_STATUS.INACTIVE
        ? -1
        : 1
  );
};

// Fetch databases based on their status
const fetchDatabasesByStatus = async (status) => {
  return fetchAllItemByDynamodbIndex({
    TableName: TABLE_NAME.DATABASES,
    IndexName: "byStatus",
    KeyConditionExpression: "#status = :statusVal",
    ExpressionAttributeValues: { ":statusVal": status },
    ExpressionAttributeNames: { "#status": "status" },
  });
};

// Fetch tracking data from DynamoDB
const fetchTrackingData = async () => {
  return getItemByQuery({
    table: TABLE_NAME.TRACKING_RESOURCES,
    KeyConditionExpression: "#date = :date AND #resource_type = :resourceType",
    FilterExpression: "#table_name = :tableName",
    ExpressionAttributeNames: {
      "#date": "date",
      "#resource_type": "resource_type",
      "#table_name": "table_name",
    },
    ExpressionAttributeValues: {
      ":date": getTodayDate,
      ":resourceType": RESOURCE_TYPE.STACKOVERFLOW,
      ":tableName": TABLE_NAME.DATABASES,
    },
  });
};

// Categorize databases into unprocessed and already processed groups
const categorizeDatabases = (databases, processedDatabases) => {
  const unprocessedDatabases = databases.filter(
    (db) => !processedDatabases.includes(db.id)
  );
  const alreadyProcessedDatabases = databases.filter((db) =>
    processedDatabases.includes(db.id)
  );
  return { unprocessedDatabases, alreadyProcessedDatabases };
};

// Process unprocessed databases
const processUnprocessedDatabases = async (databases) => {
  const processedDatabaseIds = [];

  for (const db of databases) {
    const { id: databaseId, stack_overflow_tag: sflow_tag, name } = db;

    // Use database name as tag if stack_overflow_tag is not provided
    const stack_overflow_tag = sflow_tag || name;

    // Check if metrics exist for this database and date
    const metricsData = await getItemByQuery({
      table: TABLE_NAME.METRICES,
      KeyConditionExpression: "#database_id = :database_id and #date = :date",
      ExpressionAttributeNames: {
        "#database_id": "database_id",
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":database_id": databaseId,
        ":date": getYesterdayDate,
      },
    });

    const metric = metricsData?.Items?.[0];

    // Fetch StackOverflow metrics
    const stackOverflowData = await getStackOverflowMetrics(stack_overflow_tag);

    // Update popularity with StackOverflow metrics
    const updatedPopularity = {
      ...metric?.popularity,
      stackoverflowScore: calculateStackOverflowPopularity(stackOverflowData),
    };

    // Update DynamoDB with StackOverflow data
    await updateItemInDynamoDB({
      table: TABLE_NAME.METRICES,
      Key: {
        database_id: databaseId,
        date: getYesterdayDate,
      },
      UpdateExpression:
        "SET #popularity = :popularity, #stackOverflowData = :stackOverflowData",
      ExpressionAttributeNames: {
        "#popularity": "popularity",
        "#stackOverflowData": "stackOverflowData",
      },
      ExpressionAttributeValues: {
        ":popularity": updatedPopularity,
        ":stackOverflowData": stackOverflowData,
      },
      ConditionExpression:
        "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
    });

    // Add databaseId to processedDatabaseIds
    processedDatabaseIds.push(databaseId);

    console.log(`Successfully updated stackOverflowData for name: ${name}`);
  }

  return processedDatabaseIds;
};

// Update tracking table in DynamoDB
const updateTrackingTable = async (
  mergedDatabases,
  processedDatabaseIds,
  unprocessedDatabases
) => {
  // Merge newly processed databases with already processed databases
  const newMergedDatabases = [...mergedDatabases, ...processedDatabaseIds];

  // Determine the status of the tracking
  const status =
    unprocessedDatabases?.length === 0 ? "COMPLETED" : "INPROGRESS";

  // Update the tracking table with the new state
  return updateItemInDynamoDB({
    table: TABLE_NAME.TRACKING_RESOURCES,
    Key: {
      date: getTodayDate,
      resource_type: RESOURCE_TYPE.STACKOVERFLOW,
    },
    UpdateExpression:
      "SET #processed_databases = :processedDatabases, #merged_databases = :mergedDatabases, #table_name = :tableName, #status = :status",
    ExpressionAttributeNames: {
      "#processed_databases": "processed_databases",
      "#merged_databases": "merged_databases",
      "#table_name": "table_name",
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":processedDatabases": processedDatabaseIds, // Newly processed databases
      ":mergedDatabases": newMergedDatabases, // Already processed databases
      ":tableName": TABLE_NAME.DATABASES, // It shows that this tracking is for databases
      ":status": status, // Status of the tracking
    },
  });
};
