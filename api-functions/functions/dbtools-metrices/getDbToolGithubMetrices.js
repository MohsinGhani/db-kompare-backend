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
import { fetchAllDbTools } from "../common/fetchAllDbTools.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all DB Tools for GitHub data...");

    // Fetch all active and inactive DB Tools
    const dbTools = await fetchAllDbTools();

    if (!dbTools || dbTools.length === 0) {
      console.log("No DB Tools found.");
      return sendResponse(404, "No DB Tools found.", null);
    }

    console.log("Fetching tracking data...");
    const trackingData = await fetchTrackingData();

    const trackingItem = trackingData?.Items?.[0];

    // Get the list of DB Tools that have already been processed
    const mergedDbTools = trackingItem?.merged_db_tools || [];

    // Separate unprocessed and processed DB Tools
    const { unprocessedDbTools, alreadyProcessedDbTools } = categorizeDbTools(
      dbTools,
      mergedDbTools
    );

    console.log("Unprocessed DB Tools:", unprocessedDbTools.length);
    console.log("Already processed DB Tools:", alreadyProcessedDbTools.length);

    // Process unprocessed DB Tools in batches of 30
    const processedDbToolIds = await processUnprocessedDbTools(
      unprocessedDbTools.slice(0, 30)
    );

    // Update the tracking table
    await updateTrackingTable(
      mergedDbTools,
      processedDbToolIds,
      unprocessedDbTools
    );

    console.log("Tracking table updated successfully.");
    return sendResponse(200, "GitHub metrics updated successfully", true);
  } catch (error) {
    console.error("Error updating GitHub metrics:", error);
    return sendResponse(500, "Failed to update GitHub metrics.", error.message);
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
      ":date": getTodayDate,
      ":resourceType": RESOURCE_TYPE.GITHUB,
    },
  });
};

// Categorize DB Tools into unprocessed and already processed groups
const categorizeDbTools = (dbTools, processedDbTools) => {
  const unprocessedDbTools = dbTools.filter(
    (tool) => !processedDbTools.includes(tool.id)
  );
  const alreadyProcessedDbTools = dbTools.filter((tool) =>
    processedDbTools.includes(tool.id)
  );

  return {
    unprocessedDbTools,
    alreadyProcessedDbTools,
  };
};

// Process unprocessed DB Tools
const processUnprocessedDbTools = async (dbTools) => {
  const processedDbToolIds = [];

  for (const tool of dbTools) {
    const { id: dbToolId, queries: toolQueries, tool_name: name } = tool;

    const queries = toolQueries || generateQueries(name);

    // Check if metrics exist for this DB Tool and date
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

    // Check if GitHub data already exists for this DB Tool then skip
    if (metric?.githubData) {
      console.log(`GitHub data already exists for: ${name}`);
      processedDbToolIds.push(dbToolId);
      continue;
    }

    // Fetch GitHub metrics
    const githubData = {
      totalIssues: 2,
      totalRepos: 0,
      totalStars: 0,
    };
    // const githubData = await getGitHubMetrics(queries[0]);

    // Update popularity with GitHub metrics
    const updatedPopularity = {
      ...metric?.popularity,
      githubScore: calculateGitHubPopularity(githubData),
    };

    // Update DynamoDB with GitHub data
    await updateItemInDynamoDB({
      table: TABLE_NAME.DB_TOOLS_METRICES,
      Key: {
        dbtool_id: dbToolId,
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

    // Add dbToolId to processedDbToolIds
    processedDbToolIds.push(dbToolId);

    console.log(`Successfully updated GitHub data for: ${name}`);
  }

  return processedDbToolIds;
};

// Update tracking table in DynamoDB
const updateTrackingTable = async (
  mergedDbTools, // Already processed DB Tools
  processedDbToolIds, // Newly processed DB Tools
  unprocessedDbTools // DB Tools that are yet to be processed
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
      resource_type: RESOURCE_TYPE.GITHUB,
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
