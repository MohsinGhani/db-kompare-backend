import moment from "moment";
import {
  getItem,
  fetchAllItemByDynamodbIndex,
  createItemOrUpdate,
} from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

// Use the DBToolAggregated table name from your constants (update as needed).
const METRICES_TABLE = TABLE_NAME.DB_TOOLS_METRICES; // Raw data table remains the same.
const AGGREGATED_TABLE = TABLE_NAME.DB_TOOLS_AGGREGATED; // Use the DBToolAggregated table

/**
 * Main handler function.
 * This function aggregates daily records (from the METRICES table) by dbtool_id
 * and updates the aggregated table (DBToolAggregated).
 *
 * For each record, we generate period keys (weekly, monthly, yearly) using the record's date.
 */
export const handler = async (event) => {
  try {
    // Expect query parameters: startDate and endDate (YYYY-MM-DD).
    const { startDate: startDateParam, endDate: endDateParam } =
      event.queryStringParameters || {};
    if (!startDateParam || !endDateParam) {
      return sendResponse(
        400,
        "Please provide startDate and endDate query parameters in YYYY-MM-DD format."
      );
    }

    // Validate and format dates.
    const start = moment(startDateParam, "YYYY-MM-DD", true);
    const end = moment(endDateParam, "YYYY-MM-DD", true);
    if (!start.isValid() || !end.isValid()) {
      return sendResponse(400, "Invalid date format. Use YYYY-MM-DD.");
    }
    const startStr = start.format("YYYY-MM-DD");
    const endStr = end.format("YYYY-MM-DD");

    // Query the METRICES table using the byStatusAndDate GSI.
    const queryParams = {
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
    };

    const items = await fetchAllItemByDynamodbIndex(queryParams);

    // Build an in-memory aggregated object.
    // Structure:
    // {
    //   [dbtool_id]: {
    //     weekly: { [weeklyKey]: aggregatedMetrics },
    //     monthly: { [monthlyKey]: aggregatedMetrics },
    //     yearly: { [yearlyKey]: { ...aggregatedMetrics, months: Set() } }
    //   }
    // }
    const aggregated = {};

    items.forEach((item) => {
      // Use "dbtool_id" instead of "database_id".
      const dbToolId = item.dbtool_id;
      const recordDate = moment(item.date, "YYYY-MM-DD");
      if (!recordDate.isValid()) return;

      const year = recordDate.format("YYYY");
      const month = recordDate.format("MM");
      const week = recordDate.isoWeek().toString().padStart(2, "0");

      // Build period keys.
      const weeklyKey = `weekly#${year}-W${week}`;
      const monthlyKey = `monthly#${year}-${month}`;
      const yearlyKey = `yearly#${year}`;

      if (!aggregated[dbToolId]) {
        aggregated[dbToolId] = { weekly: {}, monthly: {}, yearly: {} };
      }

      // Use raw values from the item.
      const dailyMetrics = {
        popularity: item.popularity || {},
        ui_popularity: item.ui_popularity || {},
      };

      aggregated[dbToolId].weekly[weeklyKey] = aggregated[dbToolId].weekly[
        weeklyKey
      ]
        ? accumulateMetrics(
            aggregated[dbToolId].weekly[weeklyKey],
            dailyMetrics
          )
        : accumulateMetrics(null, dailyMetrics);
      aggregated[dbToolId].monthly[monthlyKey] = aggregated[dbToolId].monthly[
        monthlyKey
      ]
        ? accumulateMetrics(
            aggregated[dbToolId].monthly[monthlyKey],
            dailyMetrics
          )
        : accumulateMetrics(null, dailyMetrics);

      if (!aggregated[dbToolId].yearly[yearlyKey]) {
        aggregated[dbToolId].yearly[yearlyKey] = {
          count: 0,
          popularity: {},
          ui_popularity: {},
          months: new Set(),
        };
      }
      aggregated[dbToolId].yearly[yearlyKey] = accumulateMetrics(
        aggregated[dbToolId].yearly[yearlyKey],
        dailyMetrics
      );
      aggregated[dbToolId].yearly[yearlyKey].months.add(month);
    });

    // Prepare update promises in chunks.
    const updatePromises = [];
    for (const dbToolId in aggregated) {
      const aggTypes = aggregated[dbToolId];
      for (const type of ["weekly", "monthly"]) {
        for (const periodKey in aggTypes[type]) {
          const currentData = aggTypes[type][periodKey];
          const divisor = currentData.count;
          currentData.popularity.average = calculateAverages(
            currentData.popularity,
            divisor
          );
          currentData.ui_popularity.average = calculateAverages(
            currentData.ui_popularity,
            divisor
          );
          currentData.popularity.count = divisor;
          currentData.ui_popularity.count = divisor;
          updatePromises.push(
            updateAggregatedRecord(dbToolId, periodKey, type, currentData)
          );
        }
      }
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
          updateAggregatedRecord(dbToolId, periodKey, "yearly", currentData)
        );
      }
    }
    await processInChunks(updatePromises, 50);

    return sendResponse(200, "Aggregation updated successfully", {});
  } catch (error) {
    console.error("Error in aggregation:", error);
    return sendResponse(500, "Failed to update aggregation", {
      error: error.message,
    });
  }
};

/**
 * accumulateMetrics: Merges daily metrics (popularity and ui_popularity) into current aggregated metrics.
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
    if (obj2[key] === null || obj2[key] === undefined || obj2[key] === "")
      continue;
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
 * divides its value by divisor, rounds to two decimals, and returns a new object.
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
 */
async function updateAggregatedRecord(dbToolId, periodKey, type, currentData) {
  const key = { dbtool_id: dbToolId, period_key: periodKey };
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
  merged.popularity.count = merged.count;
  merged.ui_popularity.count = merged.count;

  const finalItem = {
    dbtool_id: dbToolId,
    period_key: periodKey,
    aggregation_type: type,
    metrics: merged,
  };

  // Clean the final item to remove empty attributes.
  const cleanedItem = cleanObject(finalItem);
  await createItemOrUpdate(cleanedItem, AGGREGATED_TABLE);
}

/**
 * cleanObject: Recursively removes keys with empty string values.
 */
function cleanObject(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  const cleaned = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === "string") {
      if (value.trim() === "") continue;
      cleaned[key] = value;
    } else if (typeof value === "object") {
      const cleanedValue = cleanObject(value);
      if (
        typeof cleanedValue === "object" &&
        cleanedValue !== null &&
        Object.keys(cleanedValue).length === 0
      ) {
        continue;
      }
      cleaned[key] = cleanedValue;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * processInChunks: Processes an array of promises in chunks to prevent overloading.
 */
async function processInChunks(promises, chunkSize = 50) {
  for (let i = 0; i < promises.length; i += chunkSize) {
    const chunk = promises.slice(i, i + chunkSize);
    await Promise.all(chunk);
  }
}
