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
    console.log("Fetching all DB Tools for stackOverflowData...");

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
    const { unprocessedDbTools, alreadyProcessedDbTools, remainingDbTools } =
      categorizeDbTools(dbTools, mergedDbTools);

    console.log("Unprocessed DB Tools:", unprocessedDbTools.length);
    console.log("Already processed DB Tools:", alreadyProcessedDbTools.length);

    // Process unprocessed DB Tools in batches of 50
    const processedDbToolIds = await processUnprocessedDbTools(
      unprocessedDbTools.slice(0, 50)
    );

    // Update the tracking table
    await updateTrackingTable(
      mergedDbTools,
      processedDbToolIds,
      remainingDbTools
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
      ":resourceType": RESOURCE_TYPE.STACKOVERFLOW,
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
  const remainingDbTools = dbTools.slice(
    unprocessedDbTools.length + alreadyProcessedDbTools.length
  );
  return {
    unprocessedDbTools,
    alreadyProcessedDbTools,
    remainingDbTools,
  };
};

// Process unprocessed DB Tools
const processUnprocessedDbTools = async (dbTools) => {
  const processedDbToolIds = [];

  for (const tool of dbTools) {
    const {
      id: dbToolId,
      stack_overflow_tag: sflow_tag,
      tool_name: name,
    } = tool;

    // Use tool name as tag if stack_overflow_tag is not provided
    const stack_overflow_tag = sflow_tag || name;

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

    // Fetch StackOverflow metrics
    const stackOverflowData = {
      totalQuestions: 0,
      totalQuestionsAllTime: 2379,
      totalViewCount: 0,
    };
    // const stackOverflowData = await getStackOverflowMetrics(stack_overflow_tag);

    // Update popularity with StackOverflow metrics
    const updatedPopularity = {
      ...metric?.popularity,
      stackoverflowScore: calculateStackOverflowPopularity(stackOverflowData),
    };

    // Update DynamoDB with StackOverflow data
    await updateItemInDynamoDB({
      table: TABLE_NAME.DB_TOOLS_METRICES,
      Key: {
        dbtool_id: dbToolId,
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

    // Add dbToolId to processedDbToolIds
    processedDbToolIds.push(dbToolId);

    console.log(`Successfully updated stackOverflowData for name: ${name}`);
  }

  return processedDbToolIds;
};

// Update tracking table in DynamoDB
const updateTrackingTable = async (
  mergedDbTools,
  processedDbToolIds,
  unprocessedDbTools
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
      resource_type: RESOURCE_TYPE.STACKOVERFLOW,
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
