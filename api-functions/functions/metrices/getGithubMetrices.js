// import {
//   getYesterdayDate,
//   sendResponse,
//   calculateGitHubPopularity,
// } from "../../helpers/helpers.js";
// import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
// import {
//   getItemByQuery,
//   fetchAllItemByDynamodbIndex,
//   updateItemInDynamoDB,
// } from "../../helpers/dynamodb.js";
// import { getGitHubMetrics } from "../../services/githubService.js";

// export const handler = async (event) => {
//   try {
//     console.log("Fetching all active databases for GITHUB...");

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
//       console.log("No active databases found for GITHUB");
//       return sendResponse(404, "No active databases found for GITHUB", null);
//     }

//     // Process each database
//     for (const db of databases) {
//       // Destructure the useful keys
//       const { id: databaseId, queries, name } = db;

//       // Skip databases without queries
//       if (!queries || queries.length === 0) {
//         console.log(`No queries found for database_id: ${databaseId}`);
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

//       // Fetching Github Data here
//       const githubData = await getGitHubMetrics(queries[0]);

//       // Updating the popularity Object
//       const updatedPopularity = {
//         ...metric?.popularity,
//         githubScore: calculateGitHubPopularity(githubData),
//       };

//       // Updating the database to add github data and github score in our database
//       await updateItemInDynamoDB({
//         table: TABLE_NAME.METRICES,
//         Key: {
//           database_id: databaseId,
//           date: getYesterdayDate,
//         },
//         UpdateExpression:
//           "SET #popularity = :popularity, #githubData = :githubData",
//         ExpressionAttributeNames: {
//           "#popularity": "popularity",
//           "#githubData": "githubData",
//         },
//         ExpressionAttributeValues: {
//           ":popularity": updatedPopularity,
//           ":githubData": githubData,
//         },
//         ConditionExpression:
//           "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
//       });

//       console.log(`Successfully updated GitHub data for: ${name}`);
//     }

//     // Finally Sending Response
//     return sendResponse(200, "GitHub metrics updated successfully", true);
//   } catch (error) {
//     console.error("Error updating GitHub metrics:", error);
//     return sendResponse(500, "Failed to update GitHub metrics", error.message);
//   }
// };

import {
  getYesterdayDate,
  getTodayDate,
  sendResponse,
  calculateGitHubPopularity,
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
import { getGitHubMetrics } from "../../services/githubService.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all databases for GitHub data...");

    // Fetch all active and inactive databases
    const databases = await fetchAllDatabases();

    if (!databases || databases.length === 0) {
      console.log("No databases found.");
      return sendResponse(404, "No databases found.", null);
    }

    console.log("Fetching tracking data...");
    const trackingData = await fetchTrackingData();

    const trackingItem = trackingData?.Items?.[0];

    // Check if all databases have been processed
    // if (trackingItem?.status && trackingItem?.status === "COMPLETED") {
    //   console.log("All databases have been processed.");
    //   return sendResponse(200, "All databases have been processed.", true);
    // }

    // Get the list of databases that have already been processed
    const mergedDatabases = trackingItem?.merged_databases || [];

    // Separate unprocessed and processed databases
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

    // Process unprocessed databases in batches of 30
    const processedDatabaseIds = await processUnprocessedDatabases(
      unprocessedDatabases.slice(0, 30)
    );

    // Update the tracking table
    await updateTrackingTable(
      mergedDatabases,
      processedDatabaseIds,
      remainingDatabases
    );

    console.log("Tracking table updated successfully.");
    return sendResponse(200, "GitHub metrics updated successfully", true);
  } catch (error) {
    console.error("Error updating GitHub metrics:", error);
    return sendResponse(500, "Failed to update GitHub metrics.", error.message);
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
    ExpressionAttributeNames: {
      "#date": "date",
      "#resource_type": "resource_type",
    },
    ExpressionAttributeValues: {
      ":date": getTodayDate,
      ":resourceType": RESOURCE_TYPE.GITHUB,
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

  const remainingDatabases = databases.slice(
    unprocessedDatabases.length + alreadyProcessedDatabases.length
  );
  return {
    unprocessedDatabases,
    alreadyProcessedDatabases,
    remainingDatabases,
  };
};

// Process unprocessed databases
const processUnprocessedDatabases = async (databases) => {
  const processedDatabaseIds = [];

  for (const db of databases) {
    const { id: databaseId, queries: db_queries, name } = db;

    const queries = db_queries || generateQueries(name);

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

    // Check if GitHub data already exists for this database then skip
    if (metric?.githubData) {
      console.log(`GitHub data already exists for: ${name}`);
      processedDatabaseIds.push(databaseId);
      continue;
    }

    // Fetch GitHub metrics
    const githubData = await getGitHubMetrics(queries[0]);

    // Update popularity with GitHub metrics
    const updatedPopularity = {
      ...metric?.popularity,
      githubScore: calculateGitHubPopularity(githubData),
    };

    // Update DynamoDB with GitHub data
    await updateItemInDynamoDB({
      table: TABLE_NAME.METRICES,
      Key: {
        database_id: databaseId,
        date: getYesterdayDate,
      },
      UpdateExpression:
        "SET #popularity = :popularity, #githubData = :githubData",
      ExpressionAttributeNames: {
        "#popularity": "popularity",
        "#githubData": "githubData",
      },
      ExpressionAttributeValues: {
        ":popularity": updatedPopularity,
        ":githubData": githubData,
      },
      ConditionExpression:
        "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
    });

    // Add databaseId to processedDatabaseIds
    processedDatabaseIds.push(databaseId);

    console.log(`Successfully updated GitHub data for: ${name}`);
  }

  return processedDatabaseIds;
};

// Update tracking table in DynamoDB
const updateTrackingTable = async (
  mergedDatabases, // Already processed databases
  processedDatabaseIds, // Newly processed databases
  unprocessedDatabases // Databases that are yet to be processed
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
      resource_type: RESOURCE_TYPE.GITHUB,
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
