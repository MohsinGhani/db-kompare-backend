import {
  getYesterdayDate,
  sendResponse,
  calculateOverallPopularity,
  adjustAndRecalculatePopularity,
} from "../../helpers/helpers.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import {
  getItemByQuery,
  fetchAllItemByDynamodbIndex,
  updateItemInDynamoDB,
} from "../../helpers/dynamodb.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all active databases for Bing data...");

    // Fetch all active and inactive databases
    const databases = await fetchAllDatabases();

    if (!databases || databases.length === 0) {
      console.log("No active databases found for BING");
      return sendResponse(404, "No active databases found for BING", null);
    }

    // Use Promise.all to process databases concurrently
    const updateResults = await Promise.all(
      databases.map(async (db) => {
        const { id: databaseId, name } = db;

        try {
          // Check if metrics exist for this database and date
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
              ":date": getYesterdayDate,
            },
          });

          const metric = metricsData.Items[0];

          // Skip if no metrics found
          if (!metric) {
            console.log(`No metrics found for name: ${name}`);
            return { databaseId, success: false, reason: "No metrics found" };
          }

          // Updating the popularity Object
          const updatedPopularity = {
            ...metric.popularity,
            totalScore: calculateOverallPopularity(metric.popularity),
          };

          const ui_popularity = adjustAndRecalculatePopularity(
            metric.popularity
          );

          // Updating the database to add BING data and BING score in our database
          await updateItemInDynamoDB({
            table: TABLE_NAME.METRICES,
            Key: {
              database_id: databaseId,
              date: getYesterdayDate,
            },
            UpdateExpression:
              "SET #popularity = :popularity, #ui_popularity = :ui_popularity ,#includeMe = :includeMe",
            ExpressionAttributeNames: {
              "#popularity": "popularity",
              "#ui_popularity": "ui_popularity",
              "#includeMe": "includeMe",
            },
            ExpressionAttributeValues: {
              ":popularity": updatedPopularity,
              ":ui_popularity": ui_popularity,
              ":includeMe": "YES",
            },
            ConditionExpression:
              "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
          });

          console.log(`Successfully updated popularity for name: ${name}`);
          return { databaseId, success: true };
        } catch (error) {
          console.error(
            `Error updating popularity for database_id: ${databaseId}, name: ${name}`,
            error
          );
          return { databaseId, success: false, reason: error.message };
        }
      })
    );

    console.log("Update results:", updateResults);

    return sendResponse(200, "Popularity updated successfully", true);
  } catch (error) {
    console.error("Error updating popularity metrics:", error);
    return sendResponse(500, "Failed to update popularity metrics", {
      error: error.message,
    });
  }
};

// Fetch all active and inactive databases
const fetchAllDatabases = async () => {
  const [activeDatabases, inactiveDatabases] = await Promise.all([
    fetchDatabasesByStatus(DATABASE_STATUS.ACTIVE),
    fetchDatabasesByStatus(DATABASE_STATUS.INACTIVE),
  ]);

  return [...(activeDatabases || []), ...(inactiveDatabases || [])].sort(
    (a, b) =>
      a.status === DATABASE_STATUS.ACTIVE &&
      b.status === DATABASE_STATUS.INACTIVE
        ? -1
        : 1
  );
};

// Fetch databases based on their status
const fetchDatabasesByStatus = async (status) => {
  return fetchAllItemByDynamodbIndex({
    TableName: TABLE_NAME.DATABASES,
    IndexName: "byStatus",
    KeyConditionExpression: "#status = :statusVal",
    ExpressionAttributeValues: { ":statusVal": status },
    ExpressionAttributeNames: { "#status": "status" },
  });
};
