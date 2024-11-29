import axios from "axios";
import { delay } from "../helpers/helpers.js";

const BING_API_KEY = process.env.BING_API_KEY;
const BING_API_URL = "https://api.bing.microsoft.com/v7.0/search";

export async function getBingMetrics(queries) {
  const headers = { "Ocp-Apim-Subscription-Key": BING_API_KEY };
  const batchSize = 3; // Number of queries per batch
  const results = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize); // Get the next batch of 3 queries

    // Process the current batch
    const batchResults = await Promise.all(
      batch.map(async (query) => {
        try {
          const params = { q: query };
          const response = await axios.get(BING_API_URL, { headers, params });
          return {
            query,
            totalEstimatedMatches:
              response.data.webPages?.totalEstimatedMatches || 0,
          };
        } catch (error) {
          console.error(
            `Error fetching Bing data for query "${query}":`,
            error.message
          );
          return { query, totalEstimatedMatches: 100000 }; // Fallback for errors
        }
      })
    );

    results.push(...batchResults); // Add the results to the overall results array
    console.log(`Processed batch:`, batch);

    // Wait for 1 second before processing the next batch, unless this is the last batch
    if (i + batchSize < queries.length) {
      await delay(1000);
    }
  }

  return results;
}
