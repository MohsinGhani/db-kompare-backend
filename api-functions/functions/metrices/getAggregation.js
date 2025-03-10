import moment from "moment";
import { createItemOrUpdate, getItemByQuery } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

const METRICES_TABLE = TABLE_NAME.METRICES; // e.g., "db-kompare-metrices-prod"
const AGGREGATED_TABLE = TABLE_NAME.DATABASE_AGGREGATED; // e.g., "db-kompare-database-aggregated-prod"

export const handler = async (event) => {
  try {
    // Expect query parameters: startDate and endDate in YYYY-MM-DD format.
    const { startDate: startDateParam, endDate: endDateParam } =
      event.queryStringParameters || {};
    if (!startDateParam || !endDateParam) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Please provide startDate and endDate query parameters in YYYY-MM-DD format.",
        }),
      };
    }

    // Validate and format dates using Moment.js
    const start = moment(startDateParam, "YYYY-MM-DD", true);
    const end = moment(endDateParam, "YYYY-MM-DD", true);
    if (!start.isValid() || !end.isValid()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid date format. Use YYYY-MM-DD.",
        }),
      };
    }
    const startStr = start.format("YYYY-MM-DD");
    const endStr = end.format("YYYY-MM-DD");

    // Query the Metrices table using the byStatusAndDate GSI.
    const queryResult = await getItemByQuery({
      table: METRICES_TABLE,
      IndexName: "byStatusAndDate",
      KeyConditionExpression:
        "#includeMe = :includeMeVal AND #date BETWEEN :startDate AND :endDate",
      ExpressionAttributeNames: {
        "#includeMe": "includeMe",
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":includeMeVal": "YES",
        ":startDate": startStr,
        ":endDate": endStr,
      },
    });
    const items = queryResult.Items;
    console.log("Retrieved items:", items);

    // Initialize the aggregated data structure.
    // Structure: { [database_id]: { weekly: { periodKey: { count, popularityTotalScore, uiPopularityTotalScore } }, monthly: { ... }, yearly: { ... } } }
    const aggregated = {};

    // Process each daily record.
    items.forEach((item) => {
      const dbId = item.database_id;
      const dateStr = item.date; // Expected format "YYYY-MM-DD"
      const recordDate = moment(dateStr, "YYYY-MM-DD");
      if (!recordDate.isValid()) return; // Skip invalid dates

      const year = recordDate.format("YYYY");
      const month = recordDate.format("MM");
      // Use ISO week and pad the week number to two digits.
      const week = recordDate.isoWeek().toString().padStart(2, "0");

      // Build period keys.
      const weeklyKey = `weekly#${year}-W${week}`; // e.g., "weekly#2025-W02"
      const monthlyKey = `monthly#${year}-${month}`; // e.g., "monthly#2025-01"
      const yearlyKey = `yearly#${year}`; // e.g., "yearly#2025"

      // Initialize the bucket for this database if needed.
      if (!aggregated[dbId]) {
        aggregated[dbId] = { weekly: {}, monthly: {}, yearly: {} };
      }

      // Extract the two score fields (default to 0 if not present).
      const popScore =
        item.popularity && typeof item.popularity.totalScore === "number"
          ? item.popularity.totalScore
          : 0;
      const uiPopScore =
        item.ui_popularity && typeof item.ui_popularity.totalScore === "number"
          ? item.ui_popularity.totalScore
          : 0;

      // Aggregate the scores.
      aggregated[dbId].weekly[weeklyKey] = aggregateRecord(
        aggregated[dbId].weekly[weeklyKey],
        popScore,
        uiPopScore
      );
      aggregated[dbId].monthly[monthlyKey] = aggregateRecord(
        aggregated[dbId].monthly[monthlyKey],
        popScore,
        uiPopScore
      );
      aggregated[dbId].yearly[yearlyKey] = aggregateRecord(
        aggregated[dbId].yearly[yearlyKey],
        popScore,
        uiPopScore
      );
    });

    // Compute averages:
    // • Weekly: Average = totalScore / 7 (fixed denominator)
    // • Monthly: Average = totalScore / count (number of daily records)
    // • Yearly: Average = totalScore / (number of distinct months in that year)
    Object.keys(aggregated).forEach((dbId) => {
      // Weekly aggregation
      Object.keys(aggregated[dbId].weekly).forEach((weeklyKey) => {
        const rec = aggregated[dbId].weekly[weeklyKey];
        rec.averagePopularity = rec.popularityTotalScore / 7;
        rec.averageUiPopularity = rec.uiPopularityTotalScore / 7;
      });
      // Monthly aggregation
      Object.keys(aggregated[dbId].monthly).forEach((monthlyKey) => {
        const rec = aggregated[dbId].monthly[monthlyKey];
        rec.averagePopularity = rec.popularityTotalScore / rec.count;
        rec.averageUiPopularity = rec.uiPopularityTotalScore / rec.count;
      });
      // Yearly aggregation:
      Object.keys(aggregated[dbId].yearly).forEach((yearlyKey) => {
        // Determine the number of distinct months for this year from the monthly keys.
        const year = yearlyKey.split("#")[1]; // e.g., "2025"
        const monthlyKeys = Object.keys(aggregated[dbId].monthly).filter(
          (key) => key.startsWith(`monthly#${year}-`)
        );
        const numMonths = monthlyKeys.length;
        const rec = aggregated[dbId].yearly[yearlyKey];
        if (numMonths > 0) {
          rec.averagePopularity = rec.popularityTotalScore / numMonths;
          rec.averageUiPopularity = rec.uiPopularityTotalScore / numMonths;
        } else {
          rec.averagePopularity = null;
          rec.averageUiPopularity = null;
        }
      });
    });

    // Write the aggregated data into the Aggregated table.
    // For each database and for each period key (weekly, monthly, yearly), create a record.
    let putPromises = [];
    for (const dbId in aggregated) {
      const aggTypes = aggregated[dbId];
      for (const type in aggTypes) {
        for (const periodKey in aggTypes[type]) {
          const data = aggTypes[type][periodKey];
          const putParams = {
            TableName: AGGREGATED_TABLE,
            Item: {
              database_id: dbId,
              period_key: periodKey,
              aggregation_type: type, // "weekly", "monthly", or "yearly"
              metrics: data, // Contains count, totals, and averages
            },
          };
          putPromises.push(
            createItemOrUpdate(putParams.Item, putParams.TableName)
          );
        }
      }
    }
    console.log("Writing to Aggregated Table:", AGGREGATED_TABLE);
    await Promise.all(putPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Aggregation completed successfully",
        aggregated,
      }),
    };
  } catch (error) {
    console.error("Error during aggregation:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Helper function to sum scores and count records.
function aggregateRecord(current, popScore, uiPopScore) {
  if (!current) {
    return {
      count: 1,
      popularityTotalScore: popScore,
      uiPopularityTotalScore: uiPopScore,
    };
  } else {
    return {
      count: current.count + 1,
      popularityTotalScore: current.popularityTotalScore + popScore,
      uiPopularityTotalScore: current.uiPopularityTotalScore + uiPopScore,
    };
  }
}
