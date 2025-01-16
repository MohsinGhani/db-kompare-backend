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
import { fetchAllDbTools } from "../common/fetchAllDbTools.js";

// Global rate limiter to control the number of concurrent requests
const limiter = new Bottleneck({
  maxConcurrent: 3, // Allow 3 concurrent requests
  minTime: 100, // 100ms delay between requests (10 requests per second)
});

// Main handler function for the Lambda
export const handler = async (event) => {
  try {
    console.log("Fetching all DB Tools (active and inactive)...");
    const dbTools = await fetchAllDbTools();

    if (!dbTools || dbTools.length === 0) {
      console.log("No DB Tools found.");
      return sendResponse(404, "No DB Tools found.");
    }

    // We fetch the tracking data to determine which DB Tools have already been processed
    const trackingData = await fetchTrackingData();

    // Get the tracking item from the response
    const trackingItem = trackingData?.Items?.[0];

    // Get the list of DB Tools that have already been processed
    const mergedDbTools = trackingItem?.merged_db_tools || [];

    console.log("Tracking item:", trackingItem);

    // Separate unprocessed and already processed DB Tools
    const { unprocessedDbTools, alreadyProcessedDbTools, remainingDbTools } =
      categorizeDbTools(dbTools, mergedDbTools);

    console.log("Unprocessed DB Tools:", unprocessedDbTools.length);
    console.log("Already processed DB Tools:", alreadyProcessedDbTools.length);

    // Process already processed DB Tools
    await processAlreadyProcessedDbTools(alreadyProcessedDbTools);

    // Process unprocessed DB Tools and collect their IDs
    const processedDbToolIds = await processUnprocessedDbTools(
      unprocessedDbTools
    );

    // Process remaining DB Tools with placeholder values
    await processRemainingDbTools(unprocessedDbTools.slice(15));

    // Update the tracking table with the current state
    await updateTrackingTable(
      mergedDbTools, // Already processed DB Tools
      processedDbToolIds, // Newly processed DB Tools
      unprocessedDbTools // Remaining unprocessed DB Tools
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
      ":resourceType": RESOURCE_TYPE.GOOGLE,
    },
  });
};

// Categorize DB Tools into unprocessed, already processed, and remaining groups
const categorizeDbTools = (dbTools, mergedDbTools) => {
  const unprocessedDbTools = dbTools.filter(
    (tool) => !mergedDbTools.includes(tool.id)
  );
  const alreadyProcessedDbTools = dbTools.filter((tool) =>
    mergedDbTools.includes(tool.id)
  );
  const remainingDbTools = dbTools.slice(
    unprocessedDbTools.length + alreadyProcessedDbTools.length
  );

  return {
    unprocessedDbTools,
    alreadyProcessedDbTools,
    remainingDbTools,
  };
};

// Process DB Tools that have already been processed
const processAlreadyProcessedDbTools = async (dbTools) => {
  return Promise.all(
    dbTools.map(async (tool) => {
      const { id: dbToolId, tool_name: name } = tool;

      // Fetch existing metrics from DynamoDB
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

      // Calculate updated popularity metrics
      const updatedPopularity = {
        ...yesterdayMetricsData?.popularity,
        googleScore: calculateGooglePopularity(metric?.googleData || []),
      };

      // Update DynamoDB with the updated popularity
      await updateItemInDynamoDB({
        table: TABLE_NAME.DB_TOOLS_METRICES,
        Key: {
          dbtool_id: dbToolId,
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

      console.log(`Already processed DB Tool: ${name}`);
    })
  );
};

// Process unprocessed DB Tools
const processUnprocessedDbTools = async (dbTools) => {
  const dbToolsToProcess = dbTools.slice(0, 15);
  const processedDbToolIds = [];

  for (const tool of dbToolsToProcess) {
    const { id: dbToolId, queries: toolQueries, tool_name: name } = tool;
    const queries = toolQueries || generateQueries(name);

    // Fetch existing metrics
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

    // Fetch Google data for the queries
    const googleData = [
      {
        query: "Ehcache",
        totalResultsWithoutDate: 310000,
      },
      {
        query: "Ehcache",
        totalResultsWithDate: 36,
      },
      {
        query: "Ehcache issues",
        totalResults: 8,
      },
      {
        query: "Ehcache crash",
        totalResults: 3,
      },
      {
        query: "Ehcache slow",
        totalResults: 3,
      },
      {
        query: "Ehcache stuck",
        totalResults: 0,
      },
    ];
    // const googleData = await fetchGoogleDataForQueries(queries);

    // Calculate updated popularity metrics
    const updatedPopularity = {
      ...metric?.popularity,
      googleScore: calculateGooglePopularity(googleData),
    };

    // Update DynamoDB with the new metrics
    await updateItemInDynamoDB({
      table: TABLE_NAME.DB_TOOLS_METRICES,
      Key: {
        dbtool_id: dbToolId,
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

    processedDbToolIds.push(dbToolId);
    console.log(`Successfully updated Google data for DB Tool: ${name}`);
  }

  return processedDbToolIds;
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

// Process remaining unprocessed DB Tools with placeholder values
const processRemainingDbTools = async (dbTools) => {
  console.log(
    "Starting to process remaining unprocessed DB Tools with placeholder values..."
  );
  return Promise.all(
    dbTools.map(async (tool) => {
      const { id: dbToolId, tool_name: name } = tool;
      const queries = tool.queries || generateQueries(name);

      // Fetch existing metrics
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
        table: TABLE_NAME.DB_TOOLS_METRICES,
        Key: {
          dbtool_id: dbToolId,
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

      console.log(`Updated unprocessed DB Tool: ${name}`);
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

  // Determine the status of the tracking
  const status = unprocessedDbTools?.length === 0 ? "COMPLETED" : "INPROGRESS";

  // Update the tracking table with the new state
  return updateItemInDynamoDB({
    table: TABLE_NAME.TRACKING_RESOURCES,
    Key: {
      date: getTodayDate,
      resource_type: RESOURCE_TYPE.GOOGLE,
    },
    UpdateExpression:
      "SET #processed_db_tools = :processedDbTools, #merged_db_tools = :mergedDbTools, #table_name = :tableName, #status = :status",
    ExpressionAttributeNames: {
      "#processed_db_tools": "processed_db_tools",
      "#merged_db_tools": "merged_db_tools",
      "#table_name": "table_name",
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":processedDbTools": processedDbToolIds, // Newly processed DB Tools
      ":mergedDbTools": newMergedDbTools, // Already processed DB Tools
      ":tableName": TABLE_NAME.DB_TOOLS, // It shows that this tracking is for DB Tools
      ":status": status, // Status of the tracking
    },
  });
};
