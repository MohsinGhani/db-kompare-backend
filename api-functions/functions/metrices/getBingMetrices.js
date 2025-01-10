// import {
//   getYesterdayDate,
//   getTwoDaysAgoDate,
//   sendResponse,
//   calculateBingPopularity,
//   delay,
// } from "../../helpers/helpers.js";
// import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
// import {
//   getItemByQuery,
//   fetchAllItemByDynamodbIndex,
//   updateItemInDynamoDB,
// } from "../../helpers/dynamodb.js";
// import { getBingMetrics } from "../../services/bingService.js";

// export const handler = async (event) => {
//   try {
//     console.log("Fetching all active databases for Bing data...");

//     // Fetch all active databases
//     const databases = await fetchAllItemByDynamodbIndex({
//       TableName: TABLE_NAME.DATABASES,
//       IndexName: "byStatus",
//       KeyConditionExpression: "#status = :statusVal",
//       ExpressionAttributeValues: {
//         ":statusVal": DATABASE_STATUS.ACTIVE, // Active databases
//       },
//       ExpressionAttributeNames: {
//         "#status": "status",
//       },
//     });

//     if (!databases || databases.length === 0) {
//       console.log("No active databases found for BING");
//       return sendResponse(404, "No active databases found for BING", null);
//     }

//     // Process each database
//     for (const db of databases) {
//       const { id: databaseId, queries, name } = db;

//       // Skip databases without queries
//       if (!queries || queries.length === 0) {
//         console.log(
//           `Skipped database_id: ${databaseId}, name: ${name} - No queries found.`
//         );
//         continue;
//       }

//       // Check if metrics exist for this database and date
//       const metricsData = await getItemByQuery({
//         table: TABLE_NAME.METRICES,
//         KeyConditionExpression: "#database_id = :database_id and #date = :date",
//         ExpressionAttributeNames: {
//           "#database_id": "database_id",
//           "#date": "date",
//         },
//         ExpressionAttributeValues: {
//           ":database_id": databaseId,
//           ":date": getYesterdayDate,
//         },
//       });

//       const metric = metricsData.Items[0];

//       // if BING data already exist in our database then it should skip that database
//       if (metric.bingData) {
//         continue;
//       }

//       // Fetch metrics for two days ago because we need to check bing copied data
//       const twoDaysAgoMetrics = await getItemByQuery({
//         table: TABLE_NAME.METRICES,
//         KeyConditionExpression: "#database_id = :database_id and #date = :date",
//         ExpressionAttributeNames: {
//           "#database_id": "database_id",
//           "#date": "date",
//         },
//         ExpressionAttributeValues: {
//           ":database_id": databaseId,
//           ":date": getTwoDaysAgoDate,
//         },
//       });

//       // Creating variables to store data
//       let bingData = [];
//       let isBingDataCopied;

//       // If twoDaysAgoMetrics doesn't exist or Items is empty, fetch new data
//       if (!twoDaysAgoMetrics?.Items?.length) {
//         // Data doesn't exist, fetch new data
//         bingData = await getBingMetrics(queries);
//         isBingDataCopied = false; // Fresh data
//       } else {
//         // Data exists, check the "isBingDataCopied" flag
//         const existingBingData = twoDaysAgoMetrics.Items[0]?.bingData || [];
//         const isCopied = twoDaysAgoMetrics.Items[0]?.isBingDataCopied;

//         if (isCopied) {
//           // If data is copied, fetch new data
//           bingData = await getBingMetrics(queries);
//           isBingDataCopied = false; // Fresh data
//         } else {
//           bingData = existingBingData;
//           isBingDataCopied = true;
//         }
//       }
//       // Updating the popularity Object
//       const updatedPopularity = {
//         ...metric?.popularity,
//         bingScore: calculateBingPopularity(bingData),
//       };

//       // Updating the database to add BING data and BING score in our database
//       await updateItemInDynamoDB({
//         table: TABLE_NAME.METRICES,
//         Key: {
//           database_id: databaseId,
//           date: getYesterdayDate,
//         },
//         UpdateExpression:
//           "SET #popularity = :popularity, #bingData = :bingData, #isBingDataCopied =:isBingDataCopied ",
//         ExpressionAttributeNames: {
//           "#popularity": "popularity",
//           "#bingData": "bingData",
//           "#isBingDataCopied": "isBingDataCopied",
//         },
//         ExpressionAttributeValues: {
//           ":popularity": updatedPopularity,
//           ":bingData": bingData,
//           ":isBingDataCopied": isBingDataCopied,
//         },
//         ConditionExpression:
//           "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
//       });

//       console.log(`Successfully updated Bing data for name: ${name}`);
//       await delay(1000);
//     }

//     return sendResponse(200, "Bing data updated successfully", true);
//   } catch (error) {
//     console.error("Error updating Bing data metrics:", error);
//     return sendResponse(500, "Failed to update Bing data metrics", {
//       error: error.message,
//     });
//   }
// };

import {
  calculateBingPopularity,
  getYesterdayDate,
  getTwoDaysAgoDate,
  sendResponse,
  generateQueries,
  getTodayDate,
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
import { getBingMetrics } from "../../services/bingService.js";

export const handler = async (event) => {
  try {
    console.log(
      "Fetching all databases (active and inactive) for Bing data..."
    );

    // Fetch all databases
    const databases = await fetchAllDatabases();

    if (!databases || databases.length === 0) {
      console.log("No databases found for Bing.");
      return sendResponse(404, "No databases found for Bing.");
    }

    // Fetch tracking data
    const trackingData = await fetchTrackingData();

    const trackingItem = trackingData?.Items?.[0];

    // Get the list of databases that have already been processed
    const mergedDatabases = trackingItem?.merged_databases || [];

    console.log("Tracking item:", trackingItem);

    // Categorize databases into unprocessed and already processed
    const { unprocessedDatabases, alreadyProcessedDatabases } =
      categorizeDatabases(databases, mergedDatabases);

    console.log("Unprocessed databases:", unprocessedDatabases.length);
    console.log(
      "Already processed databases:",
      alreadyProcessedDatabases.length
    );

    // Process already processed databases
    await processAlreadyProcessedDatabases(alreadyProcessedDatabases);

    // Process unprocessed databases in batches
    const processedDatabaseIds = await processUnprocessedDatabases(
      unprocessedDatabases
    );

    // Process remaining databases with placeholder values
    await processRemainingDatabases(unprocessedDatabases.slice(15));

    // Update the tracking table with the new state
    await updateTrackingTable(
      mergedDatabases, // Already processed databases
      processedDatabaseIds, // Newly processed databases
      unprocessedDatabases // Remaining unprocessed databases
    );

    console.log("Tracking and ranking tables updated successfully for Bing.");
    return sendResponse(200, "Bing data updated successfully.");
  } catch (error) {
    console.error("Error processing Bing metrics:", error);
    return sendResponse(500, "Failed to process Bing metrics.", {
      error: error.message,
    });
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
      ":resourceType": RESOURCE_TYPE.BING,
      ":tableName": TABLE_NAME.DATABASES,
    },
  });
};

// Categorize databases into unprocessed and already processed groups
const categorizeDatabases = (databases, mergedDatabases) => {
  const unprocessedDatabases = databases.filter(
    (db) => !mergedDatabases.includes(db.id)
  );
  const alreadyProcessedDatabases = databases.filter((db) =>
    mergedDatabases.includes(db.id)
  );
  return { unprocessedDatabases, alreadyProcessedDatabases };
};

// Process already processed databases
const processAlreadyProcessedDatabases = async (databases) => {
  return Promise.all(
    databases.map(async (db) => {
      const { id: databaseId, name } = db;

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

      const updatedPopularity = {
        ...metric?.popularity,
        bingScore: calculateBingPopularity(metric?.bingData || []),
      };

      await updateItemInDynamoDB({
        table: TABLE_NAME.METRICES,
        Key: {
          database_id: databaseId,
          date: getYesterdayDate,
        },
        UpdateExpression:
          "SET #popularity = :popularity, #bingData = :bingData, #isBingDataCopied =:isBingDataCopied",
        ExpressionAttributeNames: {
          "#popularity": "popularity",
          "#bingData": "bingData",
          "#isBingDataCopied": "isBingDataCopied",
        },
        ExpressionAttributeValues: {
          ":popularity": updatedPopularity,
          ":bingData": metric?.bingData,
          ":isBingDataCopied": true, // Set to true to indicate that the data is copied
        },
      });

      console.log(`Processed already processed database: ${name}`);
    })
  );
};

// Process unprocessed databases
const processUnprocessedDatabases = async (databases) => {
  const databasesToProcess = databases.slice(0, 15);
  const processedDatabaseIds = [];

  for (const db of databasesToProcess) {
    const { id: databaseId, queries: db_queries, name } = db;

    // if queries are not present in the database then generate queries
    const queries = db_queries || generateQueries(name);

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

    const bingData = await getBingMetrics(queries);

    const updatedPopularity = {
      ...metric?.popularity,
      bingScore: calculateBingPopularity(bingData),
    };

    await updateItemInDynamoDB({
      table: TABLE_NAME.METRICES,
      Key: {
        database_id: databaseId,
        date: getYesterdayDate,
      },
      UpdateExpression:
        "SET #popularity = :popularity, #bingData = :bingData ,#isBingDataCopied =:isBingDataCopied ",
      ExpressionAttributeNames: {
        "#popularity": "popularity",
        "#bingData": "bingData",
        "#isBingDataCopied": "isBingDataCopied",
      },
      ExpressionAttributeValues: {
        ":popularity": updatedPopularity,
        ":bingData": bingData,
        ":isBingDataCopied": false, // Set to false to indicate that the data is not copied
      },
    });

    processedDatabaseIds.push(databaseId);
    console.log(`Processed unprocessed database: ${name}`);
  }

  return processedDatabaseIds;
};

// Process remaining databases with placeholder values
const processRemainingDatabases = async (databases) => {
  return Promise.all(
    databases.map(async (db) => {
      const { id: databaseId, name } = db;

      const queries = db.queries || generateQueries(name);

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

      const bingData = queries.map((query) => ({
        query,
        totalEstimatedMatches: 99,
      }));

      const updatedPopularity = {
        ...metric?.popularity,
        bingScore: calculateBingPopularity(bingData),
      };

      await updateItemInDynamoDB({
        table: TABLE_NAME.METRICES,
        Key: {
          database_id: databaseId,
          date: getYesterdayDate,
        },
        UpdateExpression:
          "SET #popularity = :popularity, #bingData = :bingData, #isPublished = :isPublished",
        ExpressionAttributeNames: {
          "#bingData": "bingData",
          "#isPublished": "isPublished",
          "#popularity": "popularity",
        },
        ExpressionAttributeValues: {
          ":bingData": bingData,
          ":popularity": updatedPopularity,
          ":isPublished": "NO", // Set to NO to indicate that the data is not published
        },
      });

      console.log(`Processed remaining database: ${name}`);
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

  const status =
    unprocessedDatabases?.length === 0 ? "COMPLETED" : "INPROGRESS";

  return updateItemInDynamoDB({
    table: TABLE_NAME.TRACKING_RESOURCES,
    Key: {
      date: getTodayDate,
      resource_type: RESOURCE_TYPE.BING,
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
      ":processedDatabases": processedDatabaseIds,
      ":mergedDatabases": newMergedDatabases,
      ":tableName": TABLE_NAME.DATABASES,
      ":status": status,
    },
  });
};
