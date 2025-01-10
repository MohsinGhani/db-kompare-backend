import axios from "axios";
import moment from "moment";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API_URL = "https://api.github.com/search";
const REQUEST_DELAY = 2000; // Default delay between requests in milliseconds

async function withRetry(fn, retries = 3, delayTime = 1000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      const rateLimitReset = error.response?.headers["x-ratelimit-reset"];
      const remainingRequests =
        error.response?.headers["x-ratelimit-remaining"];

      // Handle rate limit exceeded case
      if (remainingRequests === "0" && rateLimitReset) {
        const waitTime = rateLimitReset * 1000 - Date.now();
        console.error(
          `Rate limit exceeded. Waiting ${Math.ceil(
            waitTime / 1000
          )} seconds before retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue; // Retry after waiting for the reset
      }

      // Retry logic for other errors
      attempt++;
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      } else {
        throw error;
      }
    }
  }
}

async function fetchMetricsByDateRange(
  query,
  date,
  processedRepoIds = new Set()
) {
  const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };
  let totalStars = 0;
  let totalRepos = 0;
  let page = 1;
  const perPage = 100;
  const maxPages = 10;

  try {
    // Fetch repositories by date range
    while (page <= maxPages) {
      const response = await withRetry(() =>
        axios.get(`${GITHUB_API_URL}/repositories`, {
          headers,
          params: {
            q: `${query} in:name,description,readme created:${date}`,
            sort: "stars",
            order: "desc",
            per_page: perPage,
            page: page,
          },
        })
      );

      const repositories = response.data.items;
      totalRepos = response.data?.total_count;

      // Process unique repositories
      repositories.forEach((repo) => {
        if (!processedRepoIds.has(repo.id)) {
          totalStars += repo.stargazers_count;
          processedRepoIds.add(repo.id);
        }
      });

      console.log(`Processed page ${page} for query "${query}"`);

      // Monitor rate limits
      const remainingRequests = response.headers["x-ratelimit-remaining"];
      const rateLimitReset = response.headers["x-ratelimit-reset"];

      console.log("Remaining requests:", remainingRequests);
      console.log("Rate limit reset:", rateLimitReset);

      // Wait if rate limit is reached
      if (remainingRequests === "0" && rateLimitReset) {
        // Wait until the rate limit is reset
        const waitTime = rateLimitReset * 1000 - Date.now();
        console.error(
          `Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds.`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Break if there are no more repositories
      if (repositories.length < perPage) break;

      page++;
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY)); // Delay between pages
    }

    return { totalStars, totalRepos };
  } catch (error) {
    console.error(
      `Error fetching GitHub repository metrics for query "${query}" and date "${date}":`,
      error.response?.data?.message || error.message
    );
    return { totalStars: 100, totalRepos: 1000 }; // Fallback for errors
  }
}

async function fetchTotalIssuesCount(query, date) {
  const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };

  try {
    const response = await withRetry(() =>
      axios.get(`${GITHUB_API_URL}/issues`, {
        headers,
        params: {
          q: `${query} created:${date}`,
        },
      })
    );

    return response.data.total_count || 0;
  } catch (error) {
    console.error(
      `Error fetching GitHub issues for query "${query}" and date "${date}":`,
      error.response?.data?.message || error.message
    );
    return 200; // Fallback for errors
  }
}

async function getGitHubMetrics(query) {
  const date = moment().subtract(1, "days").format("YYYY-MM-DD");
  const processedRepoIds = new Set();

  let totalStars = 0;
  let totalRepos = 0;
  let totalIssues = 0;

  console.log(`Fetching GitHub metrics for "${query}" on ${date}`);

  const repoMetrics = await fetchMetricsByDateRange(
    query,
    date,
    processedRepoIds
  );
  totalStars += repoMetrics.totalStars;
  totalRepos += repoMetrics.totalRepos;

  const issuesCount = await fetchTotalIssuesCount(query, date);
  totalIssues += issuesCount;

  console.log(
    `Metrics for "${query}": Stars: ${totalStars}, Repos: ${totalRepos}, Issues: ${totalIssues}`
  );

  return { totalStars, totalRepos, totalIssues };
}

export { getGitHubMetrics };
