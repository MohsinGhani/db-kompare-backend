import moment from "moment";
import {
  createItemOrUpdate,
  fetchAllItemByDynamodbIndex,
  getItem,
} from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";

const METRICES_TABLE = TABLE_NAME.METRICES; // e.g., "db-kompare-metrices-prod"
const AGGREGATED_TABLE = TABLE_NAME.DATABASE_AGGREGATED; // e.g., "db-kompare-database-aggregated-prod"

/**
 * Main handler function.
 * This function aggregates daily records from a given date range and updates the Aggregated table.
 */
export const handler = async (event) => {
  try {
    // Expect query parameters: startDate and endDate (YYYY-MM-DD).
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

    // Validate and format dates.
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
    const queryResult = await fetchAllItemByDynamodbIndex({
      TableName: METRICES_TABLE,
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
    const items = queryResult;

    // Build an in-memory aggregated object.
    // Structure:
    // {
    //   [database_id]: {
    //     weekly: { [weeklyKey]: aggregatedMetrics },
    //     monthly: { [monthlyKey]: aggregatedMetrics },
    //     yearly: { [yearlyKey]: { ...aggregatedMetrics, months: Set() } }
    //   }
    // }
    const aggregated = {};

    // Process each daily record.
    items.forEach((item) => {
      const dbId = item.database_id;
      const recordDate = moment(item.date, "YYYY-MM-DD");
      if (!recordDate.isValid()) return;

      const year = recordDate.format("YYYY");
      const month = recordDate.format("MM");
      const week = recordDate.isoWeek().toString().padStart(2, "0");

      // Build period keys.
      const weeklyKey = `weekly#${year}-W${week}`; // e.g., "weekly#2025-W10"
      const monthlyKey = `monthly#${year}-${month}`; // e.g., "monthly#2025-03"
      const yearlyKey = `yearly#${year}`; // e.g., "yearly#2025"

      // Initialize bucket for this database if needed.
      if (!aggregated[dbId]) {
        aggregated[dbId] = { weekly: {}, monthly: {}, yearly: {} };
      }

      // Extract only the popularity and ui_popularity objects.
      const dailyMetrics = {
        popularity: item.popularity,
        ui_popularity: item.ui_popularity,
      };

      // Aggregate into weekly and monthly buckets.
      aggregated[dbId].weekly[weeklyKey] = aggregated[dbId].weekly[weeklyKey]
        ? accumulateMetrics(aggregated[dbId].weekly[weeklyKey], dailyMetrics)
        : accumulateMetrics(null, dailyMetrics);
      aggregated[dbId].monthly[monthlyKey] = aggregated[dbId].monthly[
        monthlyKey
      ]
        ? accumulateMetrics(aggregated[dbId].monthly[monthlyKey], dailyMetrics)
        : accumulateMetrics(null, dailyMetrics);

      // For yearly aggregation, also track distinct months.
      if (!aggregated[dbId].yearly[yearlyKey]) {
        aggregated[dbId].yearly[yearlyKey] = {
          count: 0,
          popularity: {},
          ui_popularity: {},
          months: new Set(),
        };
      }
      aggregated[dbId].yearly[yearlyKey] = accumulateMetrics(
        aggregated[dbId].yearly[yearlyKey],
        dailyMetrics
      );
      aggregated[dbId].yearly[yearlyKey].months.add(month);
    });

    // Prepare to update all aggregated buckets concurrently.
    const updatePromises = [];
    for (const dbId in aggregated) {
      const aggTypes = aggregated[dbId];
      // Process weekly and monthly buckets.
      for (const type of ["weekly", "monthly"]) {
        for (const periodKey in aggTypes[type]) {
          const currentData = aggTypes[type][periodKey];
          const divisor = currentData.count;
          // Calculate averages for each numeric field in popularity and ui_popularity.
          currentData.popularity.average = calculateAverages(
            currentData.popularity,
            divisor
          );
          currentData.ui_popularity.average = calculateAverages(
            currentData.ui_popularity,
            divisor
          );
          // Also store the count in each object.
          currentData.popularity.count = divisor;
          currentData.ui_popularity.count = divisor;
          updatePromises.push(
            updateAggregatedRecord(dbId, periodKey, type, currentData)
          );
        }
      }
      // Process yearly buckets.
      for (const periodKey in aggTypes.yearly) {
        const currentData = aggTypes.yearly[periodKey];
        const distinctMonthCount = currentData.months.size;
        currentData.popularity.average = calculateAverages(
          currentData.popularity,
          distinctMonthCount
        );
        currentData.ui_popularity.average = calculateAverages(
          currentData.ui_popularity,
          distinctMonthCount
        );
        currentData.popularity.count = distinctMonthCount;
        currentData.ui_popularity.count = distinctMonthCount;
        updatePromises.push(
          updateAggregatedRecord(dbId, periodKey, "yearly", currentData)
        );
      }
    }
    await Promise.all(updatePromises);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Daily aggregation updated successfully.",
      }),
    };
  } catch (error) {
    console.error("Error in daily aggregation:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * accumulateMetrics: Merges daily metrics (popularity and ui_popularity) into the current aggregated metrics.
 * It sums numeric fields and increments the count.
 */
function accumulateMetrics(current, dailyMetrics) {
  if (!current) {
    return {
      count: 1,
      popularity: { ...dailyMetrics.popularity },
      ui_popularity: { ...dailyMetrics.ui_popularity },
    };
  }
  return {
    count: current.count + 1,
    popularity: mergeObjects(current.popularity, dailyMetrics.popularity),
    ui_popularity: mergeObjects(
      current.ui_popularity,
      dailyMetrics.ui_popularity
    ),
    ...(current.months ? { months: current.months } : {}),
  };
}

/**
 * mergeObjects: Sums numeric properties from obj2 into obj1.
 * Skips null, undefined, or empty string values.
 */
function mergeObjects(obj1 = {}, obj2 = {}) {
  const result = { ...obj1 };
  for (const key in obj2) {
    if (obj2[key] === null || obj2[key] === undefined || obj2[key] === "") {
      continue;
    }
    if (typeof obj2[key] === "number") {
      result[key] = (result[key] || 0) + obj2[key];
    } else {
      result[key] = obj2[key];
    }
  }
  return result;
}

/**
 * calculateAverages: For each numeric property in obj (except 'count'),
 * divides its value by divisor and rounds to two decimals.
 * Returns an object with the same keys.
 */
function calculateAverages(obj = {}, divisor) {
  const averages = {};
  if (divisor === 0) return averages;
  for (const key in obj) {
    if (key === "count") continue;
    if (typeof obj[key] === "number") {
      averages[key] = parseFloat((obj[key] / divisor).toFixed(2));
    }
  }
  return averages;
}

/**
 * updateAggregatedRecord: Retrieves any existing aggregated record, merges with new data,
 * calculates averages, and writes the record into the Aggregated table.
 * Also adds a human-readable "display_period" field.
 */
async function updateAggregatedRecord(dbId, periodKey, type, currentData) {
  const key = { database_id: dbId, period_key: periodKey };
  let existing = await getItem(AGGREGATED_TABLE, key);
  let merged = {};
  if (existing && existing.metrics) {
    merged.count = (existing.metrics.count || 0) + currentData.count;
    merged.popularity = mergeObjects(
      existing.metrics.popularity,
      currentData.popularity
    );
    merged.ui_popularity = mergeObjects(
      existing.metrics.ui_popularity,
      currentData.ui_popularity
    );
    if (type === "yearly") {
      const existingMonths = existing.metrics.months || [];
      const newMonths = new Set(existingMonths);
      (currentData.months || []).forEach((m) => newMonths.add(m));
      merged.months = Array.from(newMonths);
      const monthCount = merged.months.length;
      merged.popularity.average = calculateAverages(
        merged.popularity,
        monthCount
      );
      merged.ui_popularity.average = calculateAverages(
        merged.ui_popularity,
        monthCount
      );
    } else {
      merged.popularity.average = calculateAverages(
        merged.popularity,
        merged.count
      );
      merged.ui_popularity.average = calculateAverages(
        merged.ui_popularity,
        merged.count
      );
    }
  } else {
    merged = { ...currentData };
    if (type === "yearly") {
      const monthCount = (currentData.months && currentData.months.size) || 1;
      merged.popularity.average = calculateAverages(
        currentData.popularity,
        monthCount
      );
      merged.ui_popularity.average = calculateAverages(
        currentData.ui_popularity,
        monthCount
      );
    } else {
      merged.popularity.average = calculateAverages(
        currentData.popularity,
        currentData.count
      );
      merged.ui_popularity.average = calculateAverages(
        currentData.ui_popularity,
        currentData.count
      );
    }
  }
  // Ensure the raw count is stored in each object.
  merged.popularity.count = merged.count;
  merged.ui_popularity.count = merged.count;

  const finalItem = {
    database_id: dbId,
    period_key: periodKey,
    aggregation_type: type,
    metrics: merged,
  };

  // Log the final item for debugging.
  console.log("Final aggregated item:", finalItem);
  await createItemOrUpdate(finalItem, AGGREGATED_TABLE);
}
