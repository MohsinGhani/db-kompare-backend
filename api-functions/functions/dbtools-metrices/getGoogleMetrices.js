import Bottleneck from "bottleneck";
import {
  calculateGooglePopularity,
  getYesterdayDate,
  getTodayDate,
  sendResponse,
  getTwoDaysAgoDate,
  generateQueries,
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
import { fetchGoogleData } from "../../services/googleService.js";

// Global rate limiter to control the number of concurrent requests
const limiter = new Bottleneck({
  maxConcurrent: 3, // Allow 3 concurrent requests
  minTime: 100, // 100ms delay between requests (10 requests per second)
});

// Main handler function for the Lambda
export const handler = async (event) => {
  try {
    console.log("Fetching all databases (active and inactive)...");
    const databases = await fetchAllDatabases();

    if (!databases || databases.length === 0) {
      console.log("No databases found.");
      return sendResponse(404, "No databases found.");
    }

    // We fetch the tracking data to determine which databases have already been processed
    const trackingData = await fetchTrackingData();

    // Get the tracking item from the response
    const trackingItem = trackingData?.Items?.[0];

    // Get the list of databases that have already been processed
    const mergedDatabases = trackingItem?.merged_databases || [];

    console.log("Tracking item:", trackingItem);

    // Separate unprocessed and already processed databases
    const {
      unprocessedDatabases,
      alreadyProcessedDatabases,
      remainingDatabases,
    } = categorizeDatabases(databases, mergedDatabases);

    console.log("Unprocessed databases:", unprocessedDatabases.length);
    console.log(
      "Already processed databases:",
      alreadyProcessedDatabases.length
    );

    // Process already processed databases
    await processAlreadyProcessedDatabases(alreadyProcessedDatabases);

    // Process unprocessed databases and collect their IDs
    const processedDatabaseIds = await processUnprocessedDatabases(
      unprocessedDatabases
    );

    // Process remaining databases with placeholder values
    await processRemainingDatabases(unprocessedDatabases.slice(15));

    // Update the tracking table with the current state
    await updateTrackingTable(
      mergedDatabases, // Already processed databases
      processedDatabaseIds, // Newly processed databases
      unprocessedDatabases // Remaining unprocessed databases
    );

    console.log("Tracking and ranking tables updated successfully.");
    return sendResponse(200, "Google data updated successfully.");
  } catch (error) {
    console.error("Error processing Google metrics:", error);
    return sendResponse(500, "Failed to process Google metrics.", {
      error: error.message,
    });
  }
};

// Fetch all active and inactive databases
const fetchAllDatabases = async () => {
  const activeDatabases = await fetchDatabasesByStatus(DATABASE_STATUS.ACTIVE);
  const inactiveDatabases = await fetchDatabasesByStatus(
    DATABASE_STATUS.INACTIVE
  );

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
    KeyConditionExpression: "#status = :status",
    ExpressionAttributeValues: { ":status": status },
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
      ":date": getYesterdayDate,
      ":resourceType": RESOURCE_TYPE.GOOGLE,
      ":tableName": TABLE_NAME.DATABASES,
    },
  });
};

// Categorize databases into unprocessed, already processed, and remaining groups
const categorizeDatabases = (databases, mergedDatabases) => {
  const unprocessedDatabases = databases.filter(
    (db) => !mergedDatabases.includes(db.id)
  );
  const alreadyProcessedDatabases = databases.filter((db) =>
    mergedDatabases.includes(db.id)
  );
  const remainingDatabases = databases.slice(
    unprocessedDatabases.length + alreadyProcessedDatabases.length
  );

  return {
    unprocessedDatabases,
    alreadyProcessedDatabases,
    remainingDatabases,
  };
};

// Process databases that have already been processed
const processAlreadyProcessedDatabases = async (databases) => {
  return Promise.all(
    databases.map(async (db) => {
      const { id: databaseId, name } = db;

      // Fetch existing metrics from DynamoDB
      const metricsData = await getItemByQuery({
        table: TABLE_NAME.METRICES,
        KeyConditionExpression: "#database_id = :database_id and #date = :date",
        ExpressionAttributeNames: {
          "#database_id": "database_id",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":database_id": databaseId,
          ":date": getTwoDaysAgoDate,
        },
      });

      const metric = metricsData?.Items?.[0];

      // Calculate updated popularity metrics
      const updatedPopularity = {
        ...metric?.popularity,
        googleScore: calculateGooglePopularity(metric?.googleData || []),
      };

      // Update DynamoDB with the updated popularity
      await updateItemInDynamoDB({
        table: TABLE_NAME.METRICES,
        Key: {
          database_id: databaseId,
          date: getYesterdayDate,
        },
        UpdateExpression:
          "SET #popularity = :popularity, #googleData = :googleData , #isGoogleDataCopied =:isGoogleDataCopied",
        ExpressionAttributeNames: {
          "#popularity": "popularity",
          "#googleData": "googleData",
          "#isGoogleDataCopied": "isGoogleDataCopied",
        },
        ExpressionAttributeValues: {
          ":popularity": updatedPopularity,
          ":googleData": metric?.googleData,
          ":isGoogleDataCopied": true,
        },
      });

      console.log(`Already processed database: ${name}`);
    })
  );
};

// Process unprocessed databases
const processUnprocessedDatabases = async (databases) => {
  const databasesToProcess = databases.slice(0, 15);
  const processedDatabaseIds = [];

  for (const db of databasesToProcess) {
    const { id: databaseId, queries: db_queries, name } = db;
    const queries = db_queries || generateQueries(name);

    // Fetch existing metrics
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

    // Fetch Google data for the queries
    const googleData = await fetchGoogleDataForQueries(queries);

    // Calculate updated popularity metrics
    const updatedPopularity = {
      ...metric?.popularity,
      googleScore: calculateGooglePopularity(googleData),
    };

    // Update DynamoDB with the new metrics
    await updateItemInDynamoDB({
      table: TABLE_NAME.METRICES,
      Key: {
        database_id: databaseId,
        date: getYesterdayDate,
      },
      UpdateExpression:
        "SET #popularity = :popularity, #googleData = :googleData, #isGoogleDataCopied = :isGoogleDataCopied",
      ExpressionAttributeNames: {
        "#popularity": "popularity",
        "#googleData": "googleData",
        "#isGoogleDataCopied": "isGoogleDataCopied",
      },
      ExpressionAttributeValues: {
        ":popularity": updatedPopularity,
        ":googleData": googleData,
        ":isGoogleDataCopied": false,
      },
    });

    processedDatabaseIds.push(databaseId);
    console.log(`Successfully updated Google data for database: ${name}`);
  }

  return processedDatabaseIds;
};

// Fetch Google data for all queries
const fetchGoogleDataForQueries = async (queries) => {
  const googleData = [];

  // Process first query with and without date restriction
  googleData.push({
    query: queries[0],
    totalResultsWithoutDate: await limiter.schedule(() =>
      fetchGoogleData(queries[0], false)
    ),
  });

  googleData.push({
    query: queries[0],
    totalResultsWithDate: await limiter.schedule(() =>
      fetchGoogleData(queries[0], true)
    ),
  });

  // Process remaining queries with date restriction
  const remainingResults = await Promise.all(
    queries.slice(1).map((query) =>
      limiter.schedule(() =>
        fetchGoogleData(query, true).then((totalResults) => ({
          query,
          totalResults,
        }))
      )
    )
  );

  googleData.push(...remainingResults);
  return googleData;
};

// Process remaining unprocessed databases with placeholder values
const processRemainingDatabases = async (databases) => {
  console.log(
    "Starting to process remaining unprocessed databases with placeholder values..."
  );
  return Promise.all(
    databases.map(async (db) => {
      const { id: databaseId, name } = db;
      const queries = db.queries || generateQueries(name);

      // Fetch existing metrics
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

      // Prepare placeholder Google data
      const googleData = queries.map((query) => ({
        query,
        totalResults: 99,
      }));

      // Calculate updated popularity metrics
      const updatedPopularity = {
        ...metric?.popularity,
        googleScore: calculateGooglePopularity(googleData),
      };

      // Update DynamoDB with placeholder data
      await updateItemInDynamoDB({
        table: TABLE_NAME.METRICES,
        Key: {
          database_id: databaseId,
          date: getYesterdayDate,
        },
        UpdateExpression:
          "SET #popularity = :popularity, #googleData = :googleData, #isPublished = :isPublished",
        ExpressionAttributeNames: {
          "#googleData": "googleData",
          "#isPublished": "isPublished",
          "#popularity": "popularity",
        },
        ExpressionAttributeValues: {
          ":googleData": googleData,
          ":popularity": updatedPopularity,
          ":isPublished": "NO",
        },
      });

      console.log(`Updated unprocessed database: ${name}`);
    })
  );
};

// Update the tracking table in DynamoDB
const updateTrackingTable = async (
  mergedDatabases, // Already processed databases
  processedDatabaseIds, // Newly processed databases
  unprocessedDatabases // Remaining unprocessed databases
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
      resource_type: RESOURCE_TYPE.GOOGLE,
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
