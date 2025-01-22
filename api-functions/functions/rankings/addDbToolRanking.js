import {
  getYesterdayDate,
  sendResponse,
  calculateGitHubPopularity,
} from "../../helpers/helpers.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import {
  getItemByQuery,
  fetchAllItemByDynamodbIndex,
  batchWriteItems,
} from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { fetchAllDbTools } from "../common/fetchAllDbTools.js";

export const handler = async (event) => {
  try {
    console.log("Fetching all active DB tools...");

    // Fetch all active DB tools
    const all_dbTools = await fetchAllDbTools();

    // Filter out objects that explicitly contain "ui_display": "NO"
    const dbTools = all_dbTools.filter((dbtool) => dbtool.ui_display !== "NO");

    if (!dbTools || dbTools.length === 0) {
      console.log("No active DB tools found.");
      return sendResponse(404, "No active DB tools found.", null);
    }

    // Fetch metrics data for the previous day (yesterday)
    const yesterday = getYesterdayDate; // Ensure this returns the correct date string (e.g., '2024-11-23')

    // Process each DB tool in parallel using Promise.all
    const toolsWithRankings = await Promise.all(
      dbTools.map(async (tool) => {
        const { id: dbtool_id, tool_name: name, category_id } = tool;

        // Check if metrics exist for this tool and date
        const metricsData = await getItemByQuery({
          table: TABLE_NAME.DB_TOOLS_METRICES,
          KeyConditionExpression: "#dbtool_id = :dbtool_id and #date = :date",
          ExpressionAttributeNames: {
            "#dbtool_id": "dbtool_id",
            "#date": "date",
          },
          ExpressionAttributeValues: {
            ":dbtool_id": dbtool_id,
            ":date": yesterday,
          },
        });

        if (!metricsData || metricsData.Items.length === 0) {
          console.log(`No metrics found for dbtool_id: ${dbtool_id}`);
          return null;
        }

        const metric = metricsData.Items[0];

        // Extract ui_popularity.totalScore
        const uiPopularity = metric?.ui_popularity;

        // Return the object containing tool details and its popularity score
        return {
          dbtool_id,
          name,
          category_id,
          uiPopularity,
        };
      })
    );

    // Filter out any null results (i.e., tools with no metrics)
    const validTools = toolsWithRankings.filter(Boolean);

    // Sort the tools by ui_popularity.totalScore in descending order
    const sortedTools = validTools.sort(
      (a, b) => b.uiPopularity.totalScore - a.uiPopularity.totalScore
    );

    // Create the rankings array for the day
    const rankings = sortedTools.map((tool, index) => ({
      dbtool_id: tool.dbtool_id,
      tool_name: tool.name,
      category_id: tool.category_id,
      rank: index + 1, // Rank starts from 1
      ui_popularity: tool.uiPopularity,
    }));

    // Prepare the item to be written to DynamoDB
    const item = {
      id: uuidv4(),
      date: yesterday,
      rankings: rankings,
      includeMe: "YES", // You can change this as needed
    };

    // Save the rankings in the DBToolsRankings table
    await batchWriteItems(TABLE_NAME.DB_TOOLS_RANKINGS, [item]);
    console.log(`Successfully updated daily rankings for ${yesterday}`);

    // Finally, sending the response
    return sendResponse(200, "Rankings updated successfully", true);
  } catch (error) {
    console.error("Error updating rankings:", error);
    return sendResponse(500, "Failed to update rankings", error.message);
  }
};
