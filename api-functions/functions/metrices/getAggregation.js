// src/aggregates/handler.js

const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const SOURCE_TABLE = process.env.SOURCE_TABLE;
const AGGREGATION_TABLE = process.env.AGGREGATION_TABLE;

// Helper function to format date to YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// Get week number from date
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week =
    Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7
    ) + 1;
  return week.toString().padStart(2, "0");
}

// Get the first and last day of a week
function getWeekDateRange(year, weekNum) {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (weekNum - 1) * 7;

  const firstDateOfWeek = new Date(
    year,
    0,
    1 + daysOffset - (firstDayOfYear.getDay() || 7) + 1
  );

  const lastDateOfWeek = new Date(firstDateOfWeek);
  lastDateOfWeek.setDate(lastDateOfWeek.getDate() + 6);

  return {
    startDate: formatDate(firstDateOfWeek),
    endDate: formatDate(lastDateOfWeek),
  };
}

// Get the first and last day of a month
function getMonthDateRange(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
  };
}

// Get the first and last day of a year
function getYearDateRange(year) {
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
  };
}

// Get data from source table for a date range
async function getDataForDateRange(startDate, endDate) {
  // Initialize parameters for query
  const params = {
    TableName: SOURCE_TABLE,
    IndexName: "byStatusAndDate",
    KeyConditionExpression:
      "includeMe = :status AND date BETWEEN :startDate AND :endDate",
    ExpressionAttributeValues: {
      ":status": "YES",
      ":startDate": startDate,
      ":endDate": endDate,
    },
  };

  let items = [];
  let lastEvaluatedKey = null;

  // Paginate through results if needed
  do {
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await dynamoDB.query(params).promise();
    items = items.concat(result.Items || []);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

// Calculate aggregates from a set of items
function calculateAggregates(items) {
  if (!items || items.length === 0) {
    return null;
  }

  const popularityAggregates = {
    bingScore: 0,
    githubScore: 0,
    googleScore: 0,
    stackoverflowScore: 0,
  };

  const uiPopularityAggregates = {
    bingScore: 0,
    githubScore: 0,
    googleScore: 0,
    stackoverflowScore: 0,
    totalScore: 0,
  };

  // Sum up all values
  items.forEach((item) => {
    // Aggregate popularity metrics
    if (item.popularity) {
      popularityAggregates.bingScore += item.popularity.bingScore || 0;
      popularityAggregates.githubScore += item.popularity.githubScore || 0;
      popularityAggregates.googleScore += item.popularity.googleScore || 0;
      popularityAggregates.stackoverflowScore +=
        item.popularity.stackoverflowScore || 0;
    }

    // Aggregate UI popularity metrics
    if (item.ui_popularity) {
      uiPopularityAggregates.bingScore += item.ui_popularity.bingScore || 0;
      uiPopularityAggregates.githubScore += item.ui_popularity.githubScore || 0;
      uiPopularityAggregates.googleScore += item.ui_popularity.googleScore || 0;
      uiPopularityAggregates.stackoverflowScore +=
        item.ui_popularity.stackoverflowScore || 0;
      uiPopularityAggregates.totalScore += item.ui_popularity.totalScore || 0;
    }
  });

  const count = items.length;

  // Calculate averages
  const avgPopularity = {
    bingScore: popularityAggregates.bingScore / count,
    githubScore: popularityAggregates.githubScore / count,
    googleScore: popularityAggregates.googleScore / count,
    stackoverflowScore: popularityAggregates.stackoverflowScore / count,
  };

  const avgUiPopularity = {
    bingScore: uiPopularityAggregates.bingScore / count,
    githubScore: uiPopularityAggregates.githubScore / count,
    googleScore: uiPopularityAggregates.googleScore / count,
    stackoverflowScore: uiPopularityAggregates.stackoverflowScore / count,
    totalScore: uiPopularityAggregates.totalScore / count,
  };

  // Return all the aggregated data
  return {
    popularity: {
      total: popularityAggregates,
      average: avgPopularity,
    },
    ui_popularity: {
      total: uiPopularityAggregates,
      average: avgUiPopularity,
    },
    count,
  };
}

// Save aggregated data to the aggregation table
async function saveAggregatedData(aggregateKey, dateRange, aggregatedData) {
  if (!aggregatedData) return;

  // Create batch request items
  const requestItems = [];

  // Add popularity item
  requestItems.push({
    PutRequest: {
      Item: {
        aggregate_key: aggregateKey,
        metric_type: "popularity",
        date_range: `${dateRange.startDate}_${dateRange.endDate}`,
        data: {
          total: aggregatedData.popularity.total,
          average: aggregatedData.popularity.average,
          count: aggregatedData.count,
        },
        created_at: new Date().toISOString(),
      },
    },
  });

  // Add UI popularity item
  requestItems.push({
    PutRequest: {
      Item: {
        aggregate_key: aggregateKey,
        metric_type: "ui_popularity",
        date_range: `${dateRange.startDate}_${dateRange.endDate}`,
        data: {
          total: aggregatedData.ui_popularity.total,
          average: aggregatedData.ui_popularity.average,
          count: aggregatedData.count,
        },
        created_at: new Date().toISOString(),
      },
    },
  });

  // Use BatchWrite to save both items
  const params = {
    RequestItems: {
      [AGGREGATION_TABLE]: requestItems,
    },
  };

  await dynamoDB.batchWrite(params).promise();
}

// Process weekly aggregates
async function processWeeklyAggregates(year, weekNum) {
  console.log(`Processing weekly aggregates for ${year}-W${weekNum}`);

  const dateRange = getWeekDateRange(year, parseInt(weekNum));
  const items = await getDataForDateRange(
    dateRange.startDate,
    dateRange.endDate
  );

  if (items.length === 0) {
    console.log(`No data found for week ${weekNum} of ${year}`);
    return;
  }

  const aggregatedData = calculateAggregates(items);
  const aggregateKey = `WEEKLY#${year}-W${weekNum}`;

  await saveAggregatedData(aggregateKey, dateRange, aggregatedData);
  console.log(`Saved weekly aggregates for ${aggregateKey}`);
}

// Process monthly aggregates
async function processMonthlyAggregates(year, month) {
  console.log(`Processing monthly aggregates for ${year}-${month}`);

  const dateRange = getMonthDateRange(year, parseInt(month));
  const items = await getDataForDateRange(
    dateRange.startDate,
    dateRange.endDate
  );

  if (items.length === 0) {
    console.log(`No data found for month ${month} of ${year}`);
    return;
  }

  const aggregatedData = calculateAggregates(items);
  const aggregateKey = `MONTHLY#${year}-${month.toString().padStart(2, "0")}`;

  await saveAggregatedData(aggregateKey, dateRange, aggregatedData);
  console.log(`Saved monthly aggregates for ${aggregateKey}`);
}

// Process yearly aggregates
async function processYearlyAggregates(year) {
  console.log(`Processing yearly aggregates for ${year}`);

  const dateRange = getYearDateRange(year);
  const items = await getDataForDateRange(
    dateRange.startDate,
    dateRange.endDate
  );

  if (items.length === 0) {
    console.log(`No data found for year ${year}`);
    return;
  }

  const aggregatedData = calculateAggregates(items);
  const aggregateKey = `YEARLY#${year}`;

  await saveAggregatedData(aggregateKey, dateRange, aggregatedData);
  console.log(`Saved yearly aggregates for ${aggregateKey}`);
}

// Main handler for processing aggregates
exports.processAggregates = async (event) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const weekNum = getWeekNumber(today);

    // Process weekly aggregates every day
    await processWeeklyAggregates(year, weekNum);

    // Process monthly aggregates on the 1st of each month
    if (today.getDate() === 1) {
      // Get previous month
      const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
      const prevMonthYear = today.getMonth() === 0 ? year - 1 : year;
      await processMonthlyAggregates(prevMonthYear, prevMonth);
    }

    // Process yearly aggregates on January 1st
    if (today.getMonth() === 0 && today.getDate() === 1) {
      await processYearlyAggregates(year - 1);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Aggregates processed successfully" }),
    };
  } catch (error) {
    console.error("Error processing aggregates:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process aggregates" }),
    };
  }
};

// Handler for retrieving aggregated data
exports.getAggregatedData = async (event) => {
  try {
    // Extract query parameters
    const { aggregationType, year, period, metricType } =
      event.queryStringParameters || {};

    // Validate required parameters
    if (!aggregationType || !year || !metricType) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Missing required parameters. Please provide aggregationType, year, and metricType.",
        }),
      };
    }

    let aggregateKey;

    // Construct the appropriate aggregate key based on aggregation type
    switch (aggregationType.toUpperCase()) {
      case "WEEKLY":
        if (!period) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: "Week number is required for weekly aggregation",
            }),
          };
        }
        aggregateKey = `WEEKLY#${year}-W${period.padStart(2, "0")}`;
        break;
      case "MONTHLY":
        if (!period) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: "Month is required for monthly aggregation",
            }),
          };
        }
        aggregateKey = `MONTHLY#${year}-${period.padStart(2, "0")}`;
        break;
      case "YEARLY":
        aggregateKey = `YEARLY#${year}`;
        break;
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Invalid aggregation type. Use WEEKLY, MONTHLY, or YEARLY.",
          }),
        };
    }

    // Query the aggregation table
    const params = {
      TableName: AGGREGATION_TABLE,
      Key: {
        aggregate_key: aggregateKey,
        metric_type: metricType,
      },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "No aggregated data found for the specified parameters",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error("Error retrieving aggregated data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to retrieve aggregated data" }),
    };
  }
};

// Optional: Function to backfill historical aggregates
exports.backfillAggregates = async (event) => {
  try {
    const { startYear, endYear } = event.queryStringParameters || {};

    if (!startYear || !endYear) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Start year and end year are required" }),
      };
    }

    // Backfill yearly aggregates
    for (let year = parseInt(startYear); year <= parseInt(endYear); year++) {
      await processYearlyAggregates(year);

      // Backfill monthly aggregates for each year
      for (let month = 1; month <= 12; month++) {
        await processMonthlyAggregates(year, month.toString().padStart(2, "0"));
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Historical aggregates backfilled successfully",
      }),
    };
  } catch (error) {
    console.error("Error backfilling aggregates:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to backfill aggregates" }),
    };
  }
};

// Resources:
// MetricsAggregation:
//   Type: AWS::DynamoDB::Table
//   Properties:
//     TableName: db-kompare-metrics-aggregated-${self:provider.stage}
//     DeletionProtectionEnabled: true
//     BillingMode: PAY_PER_REQUEST
//     AttributeDefinitions:
//       - AttributeName: db_id
//         AttributeType: S
//       - AttributeName: period_key
//         AttributeType: S
//     KeySchema:
//       - AttributeName: db_id
//         KeyType: HASH
//       - AttributeName: period_key
//         KeyType: RANGE
//     BillingMode: PAY_PER_REQUEST
