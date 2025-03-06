import {
  calculateBingPopularity,
  getYesterdayDate,
  getTwoDaysAgoDate,
  sendResponse,
  generateQueries,
  getTodayDate,
} from "../../helpers/helpers.js";
import { TABLE_NAME, RESOURCE_TYPE } from "../../helpers/constants.js";
import {
  getItemByQuery,
  updateItemInDynamoDB,
} from "../../helpers/dynamodb.js";
import { getBingMetrics } from "../../services/bingService.js";
import { fetchAllDbTools } from "../common/fetchAllDbTools.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all DB Tools (active and inactive) for Bing data...");

    // Fetch all DB Tools
    const dbTools = await fetchAllDbTools();

    if (!dbTools || dbTools.length === 0) {
      console.log("No DB Tools found for Bing.");
      return sendResponse(404, "No DB Tools found for Bing.");
    }

    // Fetch tracking data to determine processed DB Tools
    const trackingData = await fetchTrackingData();
    const trackingItem = trackingData?.Items?.[0];
    const processed_databases = trackingItem?.processed_databases || [];
    const processed_db_tools = trackingItem?.processed_db_tools || [];
    const mergedDbTools = trackingItem?.merged_db_tools || [];

    console.log("Tracking item:", trackingItem);

    // Check if all DB Tools are processed then reset the tracking table for databases to process again
    if (
      processed_db_tools.length === 0 &&
      mergedDbTools.length === dbTools.length &&
      processed_databases.length === 0
    ) {
      // No DB Tools are processed yet
      console.log("No DB Tools are processed yet...");

      await updateItemInDynamoDB({
        table: TABLE_NAME.TRACKING_RESOURCES,
        Key: {
          date: getTodayDate,
          resource_type: RESOURCE_TYPE.BING,
        },
        UpdateExpression:
          "SET #processed_databases = :processedDatabases, #merged_databases = :mergedDatabases",
        ExpressionAttributeNames: {
          "#processed_databases": "processed_databases",
          "#merged_databases": "merged_databases",
        },
        ExpressionAttributeValues: {
          ":processedDatabases": [],
          ":mergedDatabases": [],
        },
      });
    }

    if (processed_databases.length !== 0) {
      // Databases are remaining to process
      console.log("Databases are remaining to process...");

      await processRemainingDbTools(dbTools); // Handle remaining DB Tools
      await updateTrackingTable(
        [], // Already processed DB Tools
        [], // Newly processed DB Tools
        dbTools // Remaining unprocessed DB Tools
      );
    } else {
      // Categorize DB Tools into unprocessed and already processed
      const { unprocessedDbTools, alreadyProcessedDbTools } = categorizeDbTools(
        dbTools,
        mergedDbTools
      );

      console.log("Unprocessed DB Tools:", unprocessedDbTools.length);
      console.log(
        "Already processed DB Tools:",
        alreadyProcessedDbTools.length
      );

      // Process already processed DB Tools
      await processAlreadyProcessedDbTools(alreadyProcessedDbTools);

      // Process unprocessed DB Tools in batches
      const processedDbToolIds = await processUnprocessedDbTools(
        unprocessedDbTools
      );

      // Process remaining DB Tools with placeholder values
      await processRemainingDbTools(unprocessedDbTools.slice(15));

      // Update the tracking table with the new state
      await updateTrackingTable(
        mergedDbTools, // Already processed DB Tools
        processedDbToolIds, // Newly processed DB Tools
        unprocessedDbTools // Remaining unprocessed DB Tools
      );

      console.log("Tracking and ranking tables updated successfully for Bing.");
    }
    return sendResponse(200, "Bing data updated successfully.");
  } catch (error) {
    console.error("Error processing Bing metrics:", error);
    return sendResponse(500, "Failed to process Bing metrics.", {
      error: error.message,
    });
  }
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
      ":date": getYesterdayDate,
      ":resourceType": RESOURCE_TYPE.BING,
    },
  });
};

// Categorize DB Tools into unprocessed and already processed groups
const categorizeDbTools = (dbTools, mergedDbTools) => {
  const unprocessedDbTools = dbTools.filter(
    (tool) => !mergedDbTools.includes(tool.id)
  );
  const alreadyProcessedDbTools = dbTools.filter((tool) =>
    mergedDbTools.includes(tool.id)
  );
  return { unprocessedDbTools, alreadyProcessedDbTools };
};

// Process already processed DB Tools
const processAlreadyProcessedDbTools = async (dbTools) => {
  return Promise.all(
    dbTools.map(async (tool) => {
      const { id: dbToolId, tool_name: name } = tool;

      const metricsData = await getItemByQuery({
        table: TABLE_NAME.DB_TOOLS_METRICES,
        KeyConditionExpression: "#dbtool_id = :dbtool_id and #date = :date",
        ExpressionAttributeNames: {
          "#dbtool_id": "dbtool_id",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":dbtool_id": dbToolId,
          ":date": getTwoDaysAgoDate,
        },
      });

      const yesterdayMetricsData = await getItemByQuery({
        table: TABLE_NAME.DB_TOOLS_METRICES,
        KeyConditionExpression: "#dbtool_id = :dbtool_id and #date = :date",
        ExpressionAttributeNames: {
          "#dbtool_id": "dbtool_id",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":dbtool_id": dbToolId,
          ":date": getYesterdayDate,
        },
      });

      const metric = metricsData?.Items?.[0];

      const updatedPopularity = {
        ...yesterdayMetricsData?.popularity,
        bingScore: calculateBingPopularity(metric?.bingData || []),
      };

      await updateItemInDynamoDB({
        table: TABLE_NAME.DB_TOOLS_METRICES,
        Key: {
          dbtool_id: dbToolId,
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

      console.log(`Processed already processed DB Tool: ${name}`);
    })
  );
};

// Process unprocessed DB Tools
const processUnprocessedDbTools = async (dbTools) => {
  const toolsToProcess = dbTools.slice(0, 15);
  const processedDbToolIds = [];

  for (const tool of toolsToProcess) {
    const { id: dbToolId, queries: toolQueries, tool_name: name } = tool;

    // if queries are not present in the DB Tool then generate queries
    const queries = toolQueries || generateQueries(name);

    const metricsData = await getItemByQuery({
      table: TABLE_NAME.DB_TOOLS_METRICES,
      KeyConditionExpression: "#dbtool_id = :dbtool_id and #date = :date",
      ExpressionAttributeNames: {
        "#dbtool_id": "dbtool_id",
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":dbtool_id": dbToolId,
        ":date": getYesterdayDate,
      },
    });

    const metric = metricsData?.Items?.[0];

    const bingData = [
      {
        query: "Microsoft SQL Server",
        totalEstimatedMatches: 16800000,
      },
      {
        query: "SQL Server issues",
        totalEstimatedMatches: 6000000,
      },
      {
        query: "SQL Server crash",
        totalEstimatedMatches: 3530000,
      },
      {
        query: "SQL Server slow",
        totalEstimatedMatches: 2420000,
      },
      {
        query: "SQL Server stuck",
        totalEstimatedMatches: 2210000,
      },
    ];
    // const bingData = await getBingMetrics(queries);

    const updatedPopularity = {
      ...metric?.popularity,
      bingScore: calculateBingPopularity(bingData),
    };

    await updateItemInDynamoDB({
      table: TABLE_NAME.DB_TOOLS_METRICES,
      Key: {
        dbtool_id: dbToolId,
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

    processedDbToolIds.push(dbToolId);
    console.log(`Processed unprocessed DB Tool: ${name}`);
  }

  return processedDbToolIds;
};

// Process remaining DB Tools with placeholder values
const processRemainingDbTools = async (dbTools) => {
  return Promise.all(
    dbTools.map(async (tool) => {
      const { id: dbToolId, tool_name: name } = tool;

      const queries = tool.queries || generateQueries(name);

      const metricsData = await getItemByQuery({
        table: TABLE_NAME.DB_TOOLS_METRICES,
        KeyConditionExpression: "#dbtool_id = :dbtool_id and #date = :date",
        ExpressionAttributeNames: {
          "#dbtool_id": "dbtool_id",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":dbtool_id": dbToolId,
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
        table: TABLE_NAME.DB_TOOLS_METRICES,
        Key: {
          dbtool_id: dbToolId,
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

      console.log(`Processed remaining DB Tool: ${name}`);
    })
  );
};

// Update the tracking table in DynamoDB
const updateTrackingTable = async (
  mergedDbTools, // Already processed DB Tools
  processedDbToolIds, // Newly processed DB Tools
  unprocessedDbTools // Remaining unprocessed DB Tools
) => {
  // Merge newly processed DB Tools with already processed DB Tools
  const newMergedDbTools = [...mergedDbTools, ...processedDbToolIds];

  const status = unprocessedDbTools?.length === 0 ? "COMPLETED" : "INPROGRESS";

  return updateItemInDynamoDB({
    table: TABLE_NAME.TRACKING_RESOURCES,
    Key: {
      date: getTodayDate,
      resource_type: RESOURCE_TYPE.BING,
    },
    UpdateExpression:
      "SET #processed_db_tools = :processedDbTools, #merged_db_tools = :mergedDbTools,  #status = :status",
    ExpressionAttributeNames: {
      "#processed_db_tools": "processed_db_tools",
      "#merged_db_tools": "merged_db_tools",
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":processedDbTools": processedDbToolIds,
      ":mergedDbTools": newMergedDbTools,
      ":status": status,
    },
  });
};
