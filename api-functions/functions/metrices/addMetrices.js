import moment from "moment";
import {
  getItem,
  fetchAllItemByDynamodbIndex,
  createItemOrUpdate,
} from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getYesterdayDate, sendResponse } from "../../helpers/helpers.js";

const METRICES_TABLE = TABLE_NAME.METRICES; // e.g., "db-kompare-metrices-prod"
const AGGREGATED_TABLE = TABLE_NAME.DATABASE_AGGREGATED; // e.g., "db-kompare-database-aggregated-prod"

export const handler = async (event) => {
  try {
    const start = getYesterdayDate;
    const end = getYesterdayDate;

    let items = [];

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
        ":startDate": start,
        ":endDate": end,
      },
    };

    items = await fetchAllItemByDynamodbIndex(queryParams);

    const aggregated = {};

    items.forEach((item) => {
      const dbId = item.database_id;
      // Process the raw date directly.
      const recordDate = moment(item.date, "YYYY-MM-DD");
      if (!recordDate.isValid()) return;

      const year = recordDate.format("YYYY");
      const month = recordDate.format("MM");
      const week = recordDate.isoWeek().toString().padStart(2, "0");

      // Build period keys.
      const weeklyKey = `weekly#${year}-W${week}`; // e.g., "weekly#2025-W10"
      const monthlyKey = `monthly#${year}-${month}`; // e.g., "monthly#2025-03"
      const yearlyKey = `yearly#${year}`; // e.g., "yearly#2025"

      if (!aggregated[dbId]) {
        aggregated[dbId] = { weekly: {}, monthly: {}, yearly: {} };
      }

      // Use raw values from the item.
      const dailyMetrics = {
        popularity: item.popularity || {},
        ui_popularity: item.ui_popularity || {},
      };

      aggregated[dbId].weekly[weeklyKey] = aggregated[dbId].weekly[weeklyKey]
        ? accumulateMetrics(aggregated[dbId].weekly[weeklyKey], dailyMetrics)
        : accumulateMetrics(null, dailyMetrics);
      aggregated[dbId].monthly[monthlyKey] = aggregated[dbId].monthly[
        monthlyKey
      ]
        ? accumulateMetrics(aggregated[dbId].monthly[monthlyKey], dailyMetrics)
        : accumulateMetrics(null, dailyMetrics);

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

    // Prepare to update all aggregated buckets in chunks.
    const updatePromises = [];
    for (const dbId in aggregated) {
      const aggTypes = aggregated[dbId];
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
            updateAggregatedRecord(dbId, periodKey, type, currentData)
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
          updateAggregatedRecord(dbId, periodKey, "yearly", currentData)
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

async function updateAggregatedRecord(dbId, periodKey, type, currentData) {
  console.log("currentData", currentData);
  const key = { database_id: dbId, period_key: periodKey };
  let existing = (await getItem(AGGREGATED_TABLE, key)).Item;
  let merged = {};
  if (existing && existing?.metrics) {
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
    database_id: dbId,
    period_key: periodKey,
    aggregation_type: type,
    metrics: merged,
  };

  // Clean the final item to remove any empty attributes.
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
