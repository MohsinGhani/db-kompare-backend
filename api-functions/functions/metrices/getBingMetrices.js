import {
  getYesterdayDate,
  getTwoDaysAgoDate,
  sendResponse,
  calculateBingPopularity,
} from "../../helpers/helpers.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import {
  getItemByQuery,
  fetchAllItemByDynamodbIndex,
  updateItemInDynamoDB,
} from "../../helpers/dynamodb.js";
import { getBingMetrics } from "../../services/bingService.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all active databases for Bing data...");

    // Fetch all active databases
    const databases = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.DATABASES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :statusVal",
      ExpressionAttributeValues: {
        ":statusVal": DATABASE_STATUS.ACTIVE, // Active databases
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    if (!databases || databases.length === 0) {
      console.log("No active databases found for BING");
      return sendResponse(404, "No active databases found for BING", null);
    }

    // Process each database
    for (const db of databases) {
      const { id: databaseId, queries, name } = db;

      // Skip databases without queries
      if (!queries || queries.length === 0) {
        console.log(
          `Skipped database_id: ${databaseId}, name: ${name} - No queries found.`
        );
        continue;
      }

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

      const metric = metricsData.Items[0];

      // if BING data already exist in our database then it should skip that database
      if (metric.bingData) {
        continue;
      }

      // Fetch metrics for two days ago because we need to check bing copied data
      const twoDaysAgoMetrics = await getItemByQuery({
        table: TABLE_NAME.METRICES,
        KeyConditionExpression: "#database_id = :database_id and #date = :date",
        ExpressionAttributeNames: {
          "#database_id": "database_id",
          "#date": "date",
        },
        ExpressionAttributeValues: {
          ":database_id": databaseId,
          ":date": getTwoDaysAgoDate,
        },
      });

      // Creating variables to store data
      let bingData = [];
      let isBingDataCopied;

      // If twoDaysAgoMetrics doesn't exist or Items is empty, fetch new data
      if (!twoDaysAgoMetrics?.Items?.length) {
        // Data doesn't exist, fetch new data
        bingData = await getBingMetrics(queries);
        isBingDataCopied = false; // Fresh data
      } else {
        // Data exists, check the "isBingDataCopied" flag
        const existingBingData = twoDaysAgoMetrics.Items[0]?.bingData || [];
        const isCopied = twoDaysAgoMetrics.Items[0]?.isBingDataCopied;

        if (isCopied) {
          // If data is copied, fetch new data
          bingData = await getBingMetrics(queries);
          isBingDataCopied = false; // Fresh data
        } else {
          bingData = existingBingData;
          isBingDataCopied = true;
        }
      }
      // Updating the popularity Object
      const updatedPopularity = {
        ...metric?.popularity,
        bingScore: calculateBingPopularity(bingData),
      };

      // Updating the database to add BING data and BING score in our database
      await updateItemInDynamoDB({
        table: TABLE_NAME.METRICES,
        Key: {
          database_id: databaseId,
          date: getYesterdayDate,
        },
        UpdateExpression:
          "SET #popularity = :popularity, #bingData = :bingData, #isBingDataCopied =:isBingDataCopied ",
        ExpressionAttributeNames: {
          "#popularity": "popularity",
          "#bingData": "bingData",
          "#isBingDataCopied": "isBingDataCopied",
        },
        ExpressionAttributeValues: {
          ":popularity": updatedPopularity,
          ":bingData": bingData,
          ":isBingDataCopied": isBingDataCopied,
        },
        ConditionExpression:
          "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
      });

      console.log(`Successfully updated Bing data for name: ${name}`);
    }

    return sendResponse(200, "Bing data updated successfully", true);
  } catch (error) {
    console.error("Error updating Bing data metrics:", error);
    return sendResponse(500, "Failed to update Bing data metrics", {
      error: error.message,
    });
  }
};
