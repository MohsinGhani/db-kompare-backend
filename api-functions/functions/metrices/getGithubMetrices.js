import {
  getYesterdayDate,
  sendResponse,
  calculateGitHubPopularity,
} from "../../helpers/helpers.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import {
  getItemByQuery,
  fetchAllItemByDynamodbIndex,
  updateItemInDynamoDB,
} from "../../helpers/dynamodb.js";
import { getGitHubMetrics } from "../../services/githubService.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all active databases for GITHUB...");

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
      console.log("No active databases found for GITHUB");
      return sendResponse(404, "No active databases found for GITHUB", null);
    }

    // Process each database
    for (const db of databases) {
      // Destructure the useful keys
      const { id: databaseId, queries, name } = db;

      // Skip databases without queries
      if (!queries || queries.length === 0) {
        console.log(`No queries found for database_id: ${databaseId}`);
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

      // Fetching Github Data here
      const githubData = await getGitHubMetrics(queries[0]);

      // Updating the popularity Object
      const updatedPopularity = {
        ...metric?.popularity,
        githubScore: calculateGitHubPopularity(githubData),
      };

      // Updating the database to add github data and github score in our database
      await updateItemInDynamoDB({
        table: TABLE_NAME.METRICES,
        Key: {
          database_id: databaseId,
          date: getYesterdayDate,
        },
        UpdateExpression:
          "SET #popularity = :popularity, #githubData = :githubData",
        ExpressionAttributeNames: {
          "#popularity": "popularity",
          "#githubData": "githubData",
        },
        ExpressionAttributeValues: {
          ":popularity": updatedPopularity,
          ":githubData": githubData,
        },
        ConditionExpression:
          "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
      });

      console.log(`Successfully updated GitHub data for: ${name}`);
    }

    // Finally Sending Response
    return sendResponse(200, "GitHub metrics updated successfully", true);
  } catch (error) {
    console.error("Error updating GitHub metrics:", error);
    return sendResponse(500, "Failed to update GitHub metrics", error.message);
  }
};
