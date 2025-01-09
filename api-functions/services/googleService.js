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
