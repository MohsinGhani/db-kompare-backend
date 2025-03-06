import { METRICES_TYPE, TABLE_NAME } from "../../helpers/constants.js";
import {
  getItem,
  fetchAllItemByDynamodbIndex,
} from "../../helpers/dynamodb.js";
import {
  getTwoDaysAgoDate,
  getUTCTwoDaysAgoDate,
  getUTCYesterdayDate,
  getYesterdayDate,
  sendResponse,
} from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    let startDate = "";
    let endDate = "";
    let metricType = "";
    // Parse the request body
    if (event.body) {
      const parsedBody = JSON.parse(event.body);
      startDate = parsedBody.startDate;
      endDate = parsedBody.endDate;
      metricType = parsedBody.metricType;
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

    // Define the base query parameters for metrices table
    let queryParams = {
      TableName: TABLE_NAME.METRICES,
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

    // Fetch items from DynamoDB (metrices data)
    const items = await fetchAllItemByDynamodbIndex(queryParams);
    const transformedData = await transformData(items);

    // --- Ranking section ---

    // Helper to fetch ranking data for a given date (exact match)
    const getRankingDataForDate = async (dateStr) => {
      const rankingQueryParams = {
        TableName: TABLE_NAME.DATABASE_RANKINGS,
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

    // Build a lookup map for ranking (database_id -> rank)
    const rankingMap = {};
    if (rankingResult && rankingResult.length > 0) {
      // Assuming one ranking record per day; use the first record
      const rankingData = rankingResult[0];
      if (rankingData.rankings && Array.isArray(rankingData.rankings)) {
        rankingData.rankings.forEach((r) => {
          rankingMap[r.database_id] = r.rank;
        });
      }
    }

    // --- Sorting the metrics data based on the ranking ---
    // Databases without a ranking entry get a default high number to push them to the end.
    transformedData.sort((a, b) => {
      const rankA =
        rankingMap[a.databaseId] !== undefined
          ? rankingMap[a.databaseId]
          : Number.MAX_SAFE_INTEGER;
      const rankB =
        rankingMap[b.databaseId] !== undefined
          ? rankingMap[b.databaseId]
          : Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

    // Filter out objects that explicitly contain "ui_display": "NO"
    const filteredData = transformedData.filter((db) => db.ui_display !== "NO");

    return sendResponse(200, "Fetch metrices successfully", filteredData);
  } catch (error) {
    console.error("Error fetching metrices:", error);
    return sendResponse(500, "Failed to fetch metrices", {
      error: error.message,
    });
  }
};

// Get database name from the databases table
const getDatabaseNameById = async (databaseId) => {
  const key = {
    id: databaseId,
  };
  try {
    const result = await getItem(TABLE_NAME.DATABASES, key);
    if (result.Item) {
      return result.Item;
    }
    return "Unknown"; // Fallback if the database name is not found
  } catch (error) {
    console.error(`Error fetching database name for ID ${databaseId}:`, error);
    throw error;
  }
};

const transformData = async (items) => {
  // Group items by `database_id`
  const groupedData = items.reduce((acc, item) => {
    const { database_id: databaseId, date, popularity, ui_popularity } = item;

    // Ensure the database entry exists in the accumulator
    if (!acc[databaseId]) {
      acc[databaseId] = {
        databaseId,
        databaseName: "Fetching...", // Placeholder for the database name
        metrics: [],
      };
    }

    // Add metrics for the current date
    acc[databaseId].metrics.push({
      date,
      popularity,
      ui_popularity,
    });

    return acc;
  }, {});

  // Fetch database names for each unique databaseId
  const databaseIds = Object.keys(groupedData);
  await Promise.all(
    databaseIds.map(async (databaseId) => {
      const databaseName = await getDatabaseNameById(databaseId);
      groupedData[databaseId].databaseName = databaseName?.name;
      groupedData[databaseId].ui_display = databaseName?.ui_display;
    })
  );

  // Convert the grouped object to an array
  return Object.values(groupedData);
};
