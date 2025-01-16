import {
  getYesterdayDate,
  sendResponse,
  calculateOverallPopularity,
  adjustAndRecalculatePopularity,
  calculateBingPopularity,
  calculateGooglePopularity,
  calculateStackOverflowPopularity,
  calculateGitHubPopularity,
} from "../../helpers/helpers.js";
import { TABLE_NAME, DATABASE_STATUS } from "../../helpers/constants.js";
import {
  getItemByQuery,
  fetchAllItemByDynamodbIndex,
  updateItemInDynamoDB,
} from "../../helpers/dynamodb.js";
import { fetchAllDbTools } from "../common/fetchAllDbTools.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all active DB Tools for Bing data...");

    // Fetch all active and inactive DB Tools
    const dbTools = await fetchAllDbTools();

    if (!dbTools || dbTools.length === 0) {
      console.log("No active DB Tools found for BING");
      return sendResponse(404, "No active DB Tools found for BING", null);
    }

    // Use Promise.all to process DB Tools concurrently
    const updateResults = await Promise.all(
      dbTools.map(async (tool) => {
        const { id: dbToolId, tool_name: name, category_id } = tool;

        try {
          // Check if metrics exist for this DB Tool and date
          const metricsData = await getItemByQuery({
            table: TABLE_NAME.DB_TOOLS_METRICES,
            KeyConditionExpression: "#dbtool_id = :dbtool_id and #date = :date",
            ExpressionAttributeNames: {
              "#dbtool_id": "dbtool_id",
              "#date": "date",
            },
            ExpressionAttributeValues: {
              ":dbtool_id": dbToolId,
              ":date": getYesterdayDate,
            },
          });

          const metric = metricsData.Items[0];

          // Skip if no metrics found
          if (!metric) {
            console.log(`No metrics found for name: ${name}`);
            return { dbToolId, success: false, reason: "No metrics found" };
          }
          let updatedPopularity;
          let ui_popularity;

          const { bingScore, githubScore, googleScore, stackoverflowScore } =
            metric.popularity;

          if (bingScore && githubScore && googleScore && stackoverflowScore) {
            // Updating the popularity Object
            updatedPopularity = {
              ...metric.popularity,
              totalScore: calculateOverallPopularity(metric.popularity),
            };
            ui_popularity = adjustAndRecalculatePopularity(metric.popularity);
          } else {
            updatedPopularity = {
              bingScore: calculateBingPopularity(metric.bingData),
              googleScore: calculateGooglePopularity(metric.googleData),
              stackoverflowScore: calculateStackOverflowPopularity(
                metric.stackOverflowData
              ),
              githubScore: calculateGitHubPopularity(metric.githubData),
            };
            ui_popularity = adjustAndRecalculatePopularity(updatedPopularity);
          }

          // Updating the database to add BING data and BING score in our database
          await updateItemInDynamoDB({
            table: TABLE_NAME.DB_TOOLS_METRICES,
            Key: {
              dbtool_id: dbToolId,
              date: getYesterdayDate,
            },
            UpdateExpression:
              "SET #popularity = :popularity, #ui_popularity = :ui_popularity ,#includeMe = :includeMe, #category_id = :category_id",
            ExpressionAttributeNames: {
              "#popularity": "popularity",
              "#ui_popularity": "ui_popularity",
              "#includeMe": "includeMe",
              "#category_id": "category_id",
            },
            ExpressionAttributeValues: {
              ":popularity": updatedPopularity,
              ":ui_popularity": ui_popularity,
              ":includeMe": "YES",
              ":category_id": category_id,
            },
            ConditionExpression:
              "attribute_exists(#popularity) OR attribute_not_exists(#popularity)",
          });

          console.log(`Successfully updated popularity for name: ${name}`);
          return { dbToolId, success: true };
        } catch (error) {
          console.error(
            `Error updating popularity for dbtool_id: ${dbToolId}, name: ${name}`,
            error
          );
          return { dbToolId, success: false, reason: error.message };
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
