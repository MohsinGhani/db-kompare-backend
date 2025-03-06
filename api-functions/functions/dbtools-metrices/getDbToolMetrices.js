import { TABLE_NAME } from "../../helpers/constants.js";
import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
import {
  getTwoDaysAgoDate,
  getUTCTwoDaysAgoDate,
  getUTCYesterdayDate,
  getYesterdayDate,
  sendResponse,
} from "../../helpers/helpers.js";
import { fetchDbToolById } from "../common/fetchDbToolById.js";
import { fetchDbToolCategoryDetail } from "../common/fetchDbToolCategoryDetail.js";

export const handler = async (event) => {
  try {
    let startDate = "";
    let endDate = "";
    // Parse the request body
    if (event.body) {
      const parsedBody = JSON.parse(event.body);
      startDate = parsedBody.startDate;
      endDate = parsedBody.endDate;
    } else if (event.queryStringParameters) {
      startDate = event.queryStringParameters.startDate;
      endDate = event.queryStringParameters.endDate;
    }

    // Validate date range if provided
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return sendResponse(
        400,
        "Both startDate and endDate must be provided for date range filtering."
      );
    }

    // If dates are provided, ensure they are in the correct format (YYYY-MM-DD)
    if (startDate && endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return sendResponse(
          400,
          "startDate and endDate must be in YYYY-MM-DD format."
        );
      }

      if (startDate > endDate) {
        return sendResponse(400, "startDate cannot be later than endDate.");
      }
    }

    // Define the base query parameters for DB Tools metrics
    let queryParams = {
      TableName: TABLE_NAME.DB_TOOLS_METRICES,
      IndexName: "byStatusAndDate",
      KeyConditionExpression: "#includeMe = :includeMeVal",
      ExpressionAttributeNames: {
        "#includeMe": "includeMe",
      },
      ExpressionAttributeValues: {
        ":includeMeVal": "YES",
      },
    };

    // If date range is provided, add it to the KeyConditionExpression
    if (startDate && endDate) {
      queryParams.KeyConditionExpression +=
        " AND #date BETWEEN :startDate AND :endDate";
      queryParams.ExpressionAttributeNames["#date"] = "date";
      queryParams.ExpressionAttributeValues[":startDate"] = startDate;
      queryParams.ExpressionAttributeValues[":endDate"] = endDate;
    }

    // Fetch DB Tools metrics from DynamoDB
    const items = await fetchAllItemByDynamodbIndex(queryParams);
    const transformedData = await transformData(items);

    // --- Ranking Section for DB Tool Metrics ---

    // Helper to fetch ranking data for a given date
    const getRankingDataForDate = async (dateStr) => {
      const rankingQueryParams = {
        TableName: TABLE_NAME.DB_TOOLS_RANKINGS, // Ensure this constant is defined in your constants file
        IndexName: "byStatusAndDate",
        KeyConditionExpression: "#includeMe = :includeMeVal AND #date = :date",
        ExpressionAttributeNames: {
          "#includeMe": "includeMe",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":includeMeVal": "YES",
          ":date": dateStr,
        },
      };
      return await fetchAllItemByDynamodbIndex(rankingQueryParams);
    };

    let rankingResult = await getRankingDataForDate(getUTCYesterdayDate);

    // If no ranking found for yesterday, try two days ago
    if (!rankingResult || rankingResult.length === 0) {
      rankingResult = await getRankingDataForDate(getUTCTwoDaysAgoDate);
    }

    // Build a lookup map for ranking (dbToolId -> rank)
    const rankingMap = {};
    if (rankingResult && rankingResult.length > 0) {
      // Assuming one ranking record per day; use the first record
      const rankingData = rankingResult[0];
      if (rankingData.rankings && Array.isArray(rankingData.rankings)) {
        rankingData.rankings.forEach((r) => {
          rankingMap[r.dbtool_id] = r.rank;
        });
      }
    }

    // Sort the transformedData based on ranking.
    // Tools without a ranking entry are assigned a high default value.
    transformedData.sort((a, b) => {
      const rankA =
        rankingMap[a.dbToolId] !== undefined
          ? rankingMap[a.dbToolId]
          : Number.MAX_SAFE_INTEGER;
      const rankB =
        rankingMap[b.dbToolId] !== undefined
          ? rankingMap[b.dbToolId]
          : Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

    // Filter out items with ui_display explicitly set to "NO"
    const filteredData = transformedData.filter(
      (tool) => tool.ui_display !== "NO"
    );

    return sendResponse(200, "Fetch metrics successfully", filteredData);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return sendResponse(500, "Failed to fetch metrics", {
      error: error.message,
    });
  }
};

const transformData = async (items) => {
  // Group items by `dbtool_id`
  const groupedData = items.reduce((acc, item) => {
    const {
      dbtool_id: dbToolId,
      date,
      popularity,
      ui_popularity,
      category_id,
    } = item;

    // Ensure the DB Tool entry exists in the accumulator
    if (!acc[dbToolId]) {
      acc[dbToolId] = {
        dbToolId,
        categoryDetail: "Fetching...", // Placeholder for category detail
        metrics: [],
      };
    }

    // Add metrics for the current date
    acc[dbToolId].metrics.push({
      date,
      popularity,
      ui_popularity,
    });

    // Save the category ID for later use
    acc[dbToolId].categoryId = category_id;

    return acc;
  }, {});

  // Fetch category details and DB tool names for each unique dbToolId
  const dbToolIds = Object.keys(groupedData);
  await Promise.all(
    dbToolIds.map(async (dbToolId) => {
      const categoryDetail = await fetchDbToolCategoryDetail(
        groupedData[dbToolId].categoryId
      );
      const dbToolName = await fetchDbToolById(dbToolId);
      groupedData[dbToolId].dbToolName = dbToolName?.tool_name;
      groupedData[dbToolId].categoryDetail = categoryDetail;
      groupedData[dbToolId].ui_display = dbToolName?.ui_display;
    })
  );

  // Convert the grouped object to an array
  return Object.values(groupedData);
};
