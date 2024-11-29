import axios from "axios";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GOOGLE_API_URL = "https://www.googleapis.com/customsearch/v1";

async function fetchGoogleData(query, withDateRestrict = false) {
  const params = {
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: query,
    fields: "items(title,link,snippet),searchInformation(totalResults)",
  };

  if (withDateRestrict) {
    params.dateRestrict = "d1"; // Restricts to the last day
  }

  try {
    const response = await axios.get(GOOGLE_API_URL, { params });
    return parseInt(response.data.searchInformation.totalResults, 10) || 0;
  } catch (error) {
    console.error(
      `Error fetching Google data for query "${query}"${
        withDateRestrict ? " with dateRestrict" : ""
      }:`,
      error.message
    );
    return 100000; // Fallback for failed requests
  }
}

export { fetchGoogleData };

// import axios from "axios";
// import pLimit from "p-limit";

// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
// const GOOGLE_API_URL = "https://www.googleapis.com/customsearch/v1";

// // Maximum concurrent requests allowed
// const MAX_CONCURRENT_REQUESTS = 3;

// async function getGoogleMetrics(queries) {
//   try {
//     const results = [];
//     const limit = pLimit(MAX_CONCURRENT_REQUESTS); // Limit concurrency to 3

//     // Helper to fetch Google API data for a single query
//     const fetchGoogleData = async (query, withDateRestrict = false) => {
//       const params = {
//         key: GOOGLE_API_KEY,
//         cx: GOOGLE_CSE_ID,
//         q: query,
//         fields: "items(title,link,snippet),searchInformation(totalResults)",
//       };

//       if (withDateRestrict) {
//         params.dateRestrict = "d1"; // Restricts to the last day
//       }

//       try {
//         const response = await axios.get(GOOGLE_API_URL, { params });
//         return parseInt(response.data.searchInformation.totalResults, 10) || 0;
//       } catch (error) {
//         console.error(
//           `Error fetching Google data for query "${query}"${
//             withDateRestrict ? " with dateRestrict" : ""
//           }:`,
//           error.message
//         );
//         return 100000; // Fallback for failed requests
//       }
//     };

//     // First query without dateRestrict
//     const firstQuery = queries[0];
//     const totalResultsWithoutDate = await fetchGoogleData(firstQuery, false);
//     const totalResultsWithDate = await fetchGoogleData(firstQuery, true);

//     results.push(
//       {
//         query: firstQuery,
//         totalResultsWithoutDate,
//       },
//       {
//         query: firstQuery,
//         totalResultsWithDate,
//       }
//     );

//     // Process remaining queries in parallel with concurrency control
//     const remainingQueries = queries.slice(1);
//     const remainingResults = await Promise.all(
//       remainingQueries.map((query) =>
//         limit(async () => {
//           const totalResults = await fetchGoogleData(query, true);
//           return {
//             query,
//             totalResults,
//           };
//         })
//       )
//     );

//     // Combine all results
//     results.push(...remainingResults);

//     console.log("Google Metrics:", results);
//     return results;
//   } catch (error) {
//     console.error(`Error fetching Google metrics:`, error.message);
//     return null;
//   }
// }

// export { getGoogleMetrics };
