import Bottleneck from "bottleneck";
import {
  calculateGooglePopularity,
  getYesterdayDate,
  getTodayDate,
  sendResponse,
  getTwoDaysAgoDate,
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

// Global rate limiter
const limiter = new Bottleneck({
  maxConcurrent: 3, // Allow 3 concurrent requests
  minTime: 100, // 100ms delay between requests (10 requests per second)
});

export const handler = async (event) => {
  try {
    console.log("Fetching all databases (active and inactive)...");

    // Getting all active and inactive databases
    const databases = await fetchAllDatabases();

    if (!databases || databases.length === 0) {
      console.log("No databases found.");
      return sendResponse(404, "No databases found.");
    }

    // Fetch tracking table data for the previous day
    console.log("Fetching tracking data...");

    const trackingData = await getItemByQuery({
      table: TABLE_NAME.TRACKING_RESOURCES,
      KeyConditionExpression:
        "#date = :date AND #resource_type = :resourceType", // Combine both primary keys
      FilterExpression: "#table_name = :tableName", // Additional filter for table_name
      ExpressionAttributeNames: {
        "#date": "date",
        "#resource_type": "resource_type",
        "#table_name": "table_name", // Non-primary key attribute
      },
      ExpressionAttributeValues: {
        ":date": getTodayDate, // Valid date string
        ":resourceType": RESOURCE_TYPE.GOOGLE, // Valid resource type
        ":tableName": TABLE_NAME.DATABASES, // Value for table_name filter
      },
    });

    const trackingItem = trackingData?.Items?.[0];
    const mergedDatabases = trackingItem?.merged_databases || [];

    console.log("trackingItem", trackingItem);
    // Filter out merged database IDs
    const unprocessedDatabases = databases.filter(
      (db) => !mergedDatabases.includes(db.id)
    );
    console.log("unprocessed databases", unprocessedDatabases.length);
    // Filter out already processed database IDs
    const alreadyprocessedDatabases = databases.filter((db) =>
      mergedDatabases.includes(db.id)
    );
    console.log(
      "already processed Databases ",
      alreadyprocessedDatabases.length
    );
    await Promise.all(
      alreadyprocessedDatabases.map(async (db) => {
        const { id: databaseId, name, queries: db_queries } = db;

        // Generate queries for the database

        const metricsData = await getItemByQuery({
          table: TABLE_NAME.METRICES,
          KeyConditionExpression:
            "#database_id = :database_id and #date = :date",
          ExpressionAttributeNames: {
            "#database_id": "database_id",
            "#date": "date",
          },
          ExpressionAttributeValues: {
            ":database_id": databaseId,
            ":date": getTwoDaysAgoDate,
          },
        });

        const metric = metricsData?.Items?.[0];

        // const updatedPopularity = {
        //   ...metric?.popularity,
        //   googleScore: calculateGooglePopularity(googleData),
        // };

        // Update DynamoDB with googleData
        // await updateItemInDynamoDB({
        //   table: TABLE_NAME.METRICES,
        //   Key: {
        //     database_id: databaseId,
        //     date: getYesterdayDate,
        //   },
        //   UpdateExpression:
        //     "SET #popularity = :popularity, #googleData = :googleData",
        //   ExpressionAttributeNames: {
        //     "#popularity": "popularity",
        //     "#googleData": "googleData",
        //   },
        //   ExpressionAttributeValues: {
        //     ":popularity": updatedPopularity,
        //     ":googleData": metric?.googleData,
        //   },
        // });

        console.log(`Already processed database : ${name}`);
      })
    );

    // Select 15 databases to process
    const databasesToProcess = unprocessedDatabases.slice(0, 15);

    // Initialize processed database IDs
    const processedDatabaseIds = [];

    // Process selected databases
    for (const db of databasesToProcess) {
      const { id: databaseId, queries: db_queries, name } = db;

      // Generate queries if not provided
      const queries = db_queries || generateQueries(name);

      // Check if metrics exist for this database and date
      const metricsData = await getItemByQuery({
        table: TABLE_NAME.METRICES,
        KeyConditionExpression: "#database_id = :database_id and #date = :date",
        ExpressionAttributeNames: {
          "#database_id": "database_id",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":database_id": databaseId,
          ":date": getYesterdayDate,
        },
      });

      const metric = metricsData?.Items?.[0];

      // Prepare the googleData array
      const googleData = [];

      // // Process first query with and without dateRestrict
      // googleData.push({
      //   query: queries[0],
      //   totalResultsWithoutDate: await limiter.schedule(() =>
      //     fetchGoogleData(queries[0], false)
      //   ),
      // });

      // googleData.push({
      //   query: queries[0],
      //   totalResultsWithDate: await limiter.schedule(() =>
      //     fetchGoogleData(queries[0], true)
      //   ),
      // });

      // // Process remaining queries with dateRestrict
      // const remainingResults = await Promise.all(
      //   queries.slice(1).map((query) =>
      //     limiter.schedule(() =>
      //       fetchGoogleData(query, true).then((totalResults) => ({
      //         query,
      //         totalResults,
      //       }))
      //     )
      //   )
      // );
      // googleData.push(...remainingResults);

      // const updatedPopularity = {
      //   ...metric?.popularity,
      //   googleScore: calculateGooglePopularity(googleData),
      // };

      // Update DynamoDB with googleData
      // await updateItemInDynamoDB({
      //   table: TABLE_NAME.METRICES,
      //   Key: {
      //     database_id: databaseId,
      //     date: getYesterdayDate,
      //   },
      //   UpdateExpression:
      //     "SET #popularity = :popularity, #googleData = :googleData",
      //   ExpressionAttributeNames: {
      //     "#popularity": "popularity",
      //     "#googleData": "googleData",
      //   },
      //   ExpressionAttributeValues: {
      //     ":popularity": updatedPopularity,
      //     ":googleData": googleData,
      //   },
      // });

      processedDatabaseIds.push(databaseId);

      console.log(`Successfully updated Google data for database: ${name}`);
    }

    // Process remaining databases
    const databasesNotProcessed = unprocessedDatabases.slice(15);

    await Promise.all(
      databasesNotProcessed.map(async (db) => {
        const { id: databaseId, name, queries: db_queries } = db;

        // Generate queries for the database
        const queries = db_queries || generateQueries(name);

        // Prepare the googleData array with fixed value of 99 for each query
        const googleData = queries.map((query) => ({
          query,
          totalResults: 99,
        }));

        // Update DynamoDB for the unprocessed database
        // await updateItemInDynamoDB({
        //   table: TABLE_NAME.METRICES,
        //   Key: {
        //     database_id: databaseId,
        //     date: getYesterdayDate,
        //   },
        //   UpdateExpression:
        //     "SET #googleData = :googleData, #isPublished = :isPublished",
        //   ExpressionAttributeNames: {
        //     "#googleData": "googleData",
        //     "#isPublished": "isPublished",
        //   },
        //   ExpressionAttributeValues: {
        //     ":googleData": googleData,
        //     ":isPublished": "NO",
        //   },
        // });

        console.log(`Updated unprocessed database : ${name}`);
      })
    );

    // Update tracking table
    const newMergedDatabases = [...mergedDatabases, ...processedDatabaseIds];
    await updateItemInDynamoDB({
      table: TABLE_NAME.TRACKING_RESOURCES,
      Key: {
        date: getTodayDate, // Partition key
        resource_type: RESOURCE_TYPE.GOOGLE, // Sort key
      },
      UpdateExpression:
        "SET #processed_databases = :processedDatabases, #merged_databases = :mergedDatabases, #resouce_type = :resourceType, #table_name = :table_name, #status = :status",
      ExpressionAttributeNames: {
        "#processed_databases": "processed_databases",
        "#merged_databases": "merged_databases",
        "#resouce_type": "resouce_type",
        "#table_name": "table_name",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":processedDatabases": processedDatabaseIds,
        ":mergedDatabases": newMergedDatabases,
        ":resourceType": RESOURCE_TYPE.GOOGLE,
        ":table_name": TABLE_NAME.DATABASES,
        ":status":
          unprocessedDatabases?.length === 0 ? "COMPLETED" : "INPROGRESS",
      },
    });

    console.log("Tracking and ranking tables updated successfully.");

    return sendResponse(200, "Google data updated successfully.");
  } catch (error) {
    console.error("Error processing Google metrics:", error);
    return sendResponse(500, "Failed to process Google metrics.", {
      error: error.message,
    });
  }
};

// Fetch all active and inactive databases
const fetchAllDatabases = async () => {
  const activeDatabases = await fetchAllItemByDynamodbIndex({
    TableName: TABLE_NAME.DATABASES,
    IndexName: "byStatus",
    KeyConditionExpression: "#status = :active",
    ExpressionAttributeValues: {
      ":active": DATABASE_STATUS.ACTIVE,
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  });

  const inactiveDatabases = await fetchAllItemByDynamodbIndex({
    TableName: TABLE_NAME.DATABASES,
    IndexName: "byStatus",
    KeyConditionExpression: "#status = :inactive",
    ExpressionAttributeValues: {
      ":inactive": DATABASE_STATUS.INACTIVE,
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  });

  // Combine and sort databases by status, prioritizing active databases
  const combinedDatabases = [
    ...(activeDatabases || []),
    ...(inactiveDatabases || []),
  ];

  return combinedDatabases.sort((a, b) => {
    if (
      a.status === DATABASE_STATUS.ACTIVE &&
      b.status === DATABASE_STATUS.INACTIVE
    ) {
      return -1; // Active comes before inactive
    }
    if (
      a.status === DATABASE_STATUS.INACTIVE &&
      b.status === DATABASE_STATUS.ACTIVE
    ) {
      return 1; // Inactive comes after active
    }
    return 0; // Preserve order if both are the same
  });
};

const generateQueries = (name) => {
  const queries = [
    `${name}`,
    `${name} issues`,
    `${name} crash`,
    `${name} slow`,
    `${name} stuck`,
  ];

  return queries;
};
