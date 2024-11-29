import moment from "moment";
import { RESOURCE_TYPE } from "./constants.js";

export const getTableName = (name) => {
  return `${name}`;
};

export const sendResponse = (statusCode, message, data) => {
  return {
    statusCode,
    body: JSON.stringify({
      message,
      data,
    }),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    },
  };
};

export const convertToUnixTimestamp = (date) =>
  Math.floor(new Date(date).getTime() / 1000);

export const getDayTimestamps = (dateString) => {
  const date = new Date(dateString);

  const startOfDay = Math.floor(
    new Date(date.setUTCHours(0, 0, 0, 0)).getTime() / 1000
  );

  const endOfDay = Math.floor(
    new Date(date.setUTCHours(23, 59, 59, 999)).getTime() / 1000
  );

  return { startOfDay, endOfDay };
};

export const formatDateToCompact = (dateString) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }

  return dateString.replace(/-/g, "");
};

export const generateMonthlyDateRanges = (year) => {
  const dateRanges = [];
  for (let month = 1; month <= 12; month++) {
    const start = moment.utc([year, month - 1, 1]).format("YYYY-MM-DD");
    const end = moment
      .utc([year, month - 1])
      .endOf("month")
      .format("YYYY-MM-DD");
    dateRanges.push({ start, end });
  }
  return dateRanges;
};

export const generateDailyDateRanges = (year) => {
  const dateRanges = [];
  const startOfYear = moment.utc([year, 0, 1]);
  const endOfYear = moment.utc([year, 11, 31]);

  let currentDate = startOfYear;
  while (currentDate.isSameOrBefore(endOfYear)) {
    const date = currentDate.format("YYYY-MM-DD");
    dateRanges.push({ start: date, end: date });
    currentDate.add(1, "day");
  }

  return dateRanges;
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getYesterdayDate = moment()
  .subtract(1, "days")
  .format("YYYY-MM-DD");

export const getTwoDaysAgoDate = moment()
  .subtract(2, "days")
  .format("YYYY-MM-DD");

export const calculateGitHubPopularity = ({
  totalIssues,
  totalStars,
  totalRepos,
}) => {
  return (totalStars * 0.1 + totalRepos * 0.6 - totalIssues * 0.3) * 100000;
};

export const calculateStackOverflowPopularity = ({
  totalQuestions,
  totalQuestionsAllTime,
  totalViewCount,
}) => {
  return (
    (totalQuestions * 0.7 + totalViewCount * 0.3) * 100000 +
    totalQuestionsAllTime
  );
};

export const calculateGooglePopularity = (data) => {
  const totalResultsSum = data
    .filter((value) => value.totalResults)
    .reduce((sum, value) => sum + value.totalResults, 0);

  const weightedSum = data.reduce((sum, value) => {
    const totalResultsWithoutDate = value.totalResultsWithoutDate || 0;
    const totalResultsWithDate = value.totalResultsWithDate || 0;

    return sum + totalResultsWithoutDate * 0.002 + totalResultsWithDate * 0.448;
  }, 0);

  return weightedSum - totalResultsSum * 0.5;
};

export const calculateBingPopularity = (data) => {
  const firstQueryMatches = data[0].totalEstimatedMatches || 0;

  const totalQueriesSum = data.slice(1).reduce((sum, item) => {
    return sum + (item.totalEstimatedMatches || 0);
  }, 0);

  return firstQueryMatches * 0.5 - totalQueriesSum * 0.5;
};

export const adjustAndRecalculatePopularity = (scores) => {
  const { googleScore, githubScore, bingScore, stackoverflowScore } = scores;

  // Adjust individual scores if negative
  const adjustedScores = {
    googleScore: googleScore < 0 ? 200000 : googleScore,
    githubScore: githubScore < 0 ? 200000 : githubScore,
    bingScore: bingScore < 0 ? 200000 : bingScore,
    stackoverflowScore: stackoverflowScore < 0 ? 200000 : stackoverflowScore,
  };

  // Calculate totalScore
  adjustedScores.totalScore = calculateOverallPopularity(adjustedScores);

  return adjustedScores;
};

export const calculateOverallPopularity = ({
  googleScore,
  githubScore,
  bingScore,
  stackoverflowScore,
}) => {
  return (
    googleScore * 0.2 +
    bingScore * 0.1 +
    githubScore * 0.4 +
    stackoverflowScore * 0.3
  );
};

export const getPopularityByFormula = (resourceType, data) => {
  switch (resourceType) {
    case RESOURCE_TYPE.GITHUB:
      return calculateGitHubPopularity(data);
    case RESOURCE_TYPE.STACKOVERFLOW:
      return calculateStackOverflowPopularity(data);
    case RESOURCE_TYPE.GOOGLE:
      return calculateGooglePopularity(data);
    case RESOURCE_TYPE.BING:
      return calculateBingPopularity(data);
    case RESOURCE_TYPE.ALL:
      return calculateOverallPopularity(data);
    default:
      throw new Error("Invalid resource type");
  }
};

export const getMiddleDate = (date1, date2) => {
  // Parse the dates using moment
  const startDate = moment(date1);
  const endDate = moment(date2);

  // Check if both dates are valid
  if (!startDate.isValid() || !endDate.isValid()) {
    throw new Error("Invalid date(s) provided.");
  }

  // Calculate the difference between the two dates in milliseconds
  const diffInMilliseconds = endDate.diff(startDate);

  // Calculate the middle date by adding half of the difference to the start date
  const middleDate = startDate.add(diffInMilliseconds / 2, "milliseconds");

  // Return the middle date in desired format (e.g., "YYYY-MM-DD")
  return middleDate.format("YYYY-MM-DD");
};

export const getAdjustedDates = () => {
  // Get the current UTC time
  const currentUtcTime = moment.utc();
  console.log("currentUtcTime", currentUtcTime);
  // Define the time threshold for 5:00 AM UTC
  const thresholdTime = moment
    .utc()
    .set({ hour: 5, minute: 0, second: 0, millisecond: 0 });

  // If the current time is before 5:00 AM UTC today, adjust to the previous day's dates
  if (currentUtcTime.isBefore(thresholdTime)) {
    currentUtcTime.subtract(1, "days"); // Subtract 1 day if before 5:00 AM UTC
  }

  // Get the startDate and endDate for the database, assuming they are dynamic
  // Example: starting from current date
  const startDate = currentUtcTime.subtract(3, "days").format("YYYY-MM-DD"); // Format as '2024-11-23'
  const endDate = currentUtcTime.subtract(1, "days").format("YYYY-MM-DD"); // Add 2 days for endDate

  // Return the adjusted dates
  return { startDate, endDate };
};
