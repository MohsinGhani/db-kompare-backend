import { TABLE_NAME } from "../../helpers/constants.js";
import {
  getItem,
  fetchAllItemByDynamodbIndex,
} from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchDbToolById } from "../common/fetchDbToolById.js";
import { fetchDbToolCategoryDetail } from "../common/fetchDbToolCategoryDetail.js";

export const handler = async (event) => {
  try {
    let startDate = "";
    let endDate = "";
    // Parse the request body
    if (event.body) {
      const parsedBody = JSON.parse(event.body);
      startDate = parsedBody.startDate;
      endDate = parsedBody.endDate;
    } else if (event.queryStringParameters) {
      startDate = event.queryStringParameters.startDate;
      endDate = event.queryStringParameters.endDate;
    }

    // Validate date range if provided
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return sendResponse(
        400,
        "Both startDate and endDate must be provided for date range filtering."
      );
    }

    // If dates are provided, ensure they are in the correct format (YYYY-MM-DD)
    if (startDate && endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return sendResponse(
          400,
          "startDate and endDate must be in YYYY-MM-DD format."
        );
      }

      if (startDate > endDate) {
        return sendResponse(400, "startDate cannot be later than endDate.");
      }
    }

    // Define the base query parameters
    let queryParams = {
      TableName: TABLE_NAME.DB_TOOLS_METRICES,
      IndexName: "byStatusAndDate",
      KeyConditionExpression: "#includeMe = :includeMeVal",
      ExpressionAttributeNames: {
        "#includeMe": "includeMe",
      },
      ExpressionAttributeValues: {
        ":includeMeVal": "YES",
      },
    };

    // If date range is provided, add it to the KeyConditionExpression
    if (startDate && endDate) {
      queryParams.KeyConditionExpression +=
        " AND #date BETWEEN :startDate AND :endDate";
      queryParams.ExpressionAttributeNames["#date"] = "date";
      queryParams.ExpressionAttributeValues[":startDate"] = startDate;
      queryParams.ExpressionAttributeValues[":endDate"] = endDate;
    }

    // Fetch items from DynamoDB
    const items = await fetchAllItemByDynamodbIndex(queryParams);
    const transformedData = await transformData(items);

    const filteredData = transformedData.filter((db) => db.ui_display !== "NO");

    return sendResponse(200, "Fetch metrics successfully", filteredData);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return sendResponse(500, "Failed to fetch metrics", {
      error: error.message,
    });
  }
};

const transformData = async (items) => {
  // Group items by `dbToolId`
  const groupedData = items.reduce((acc, item) => {
    const {
      dbtool_id: dbToolId,
      date,
      popularity,
      ui_popularity,
      category_id,
    } = item;

    // Ensure the DB Tool entry exists in the accumulator
    if (!acc[dbToolId]) {
      acc[dbToolId] = {
        dbToolId,
        categoryDetail: "Fetching...", // Placeholder for the category detail
        metrics: [],
      };
    }

    // Add metrics for the current date
    acc[dbToolId].metrics.push({
      date,
      popularity,
      ui_popularity,
    });

    // Add category_id for fetching category detail later
    acc[dbToolId].categoryId = category_id;

    return acc;
  }, {});

  // Fetch category details for each unique dbToolId
  const dbToolIds = Object.keys(groupedData);
  await Promise.all(
    dbToolIds.map(async (dbToolId) => {
      const categoryDetail = await fetchDbToolCategoryDetail(
        groupedData[dbToolId].categoryId
      );
      const dbToolName = await fetchDbToolById(dbToolId);
      groupedData[dbToolId].dbToolName = dbToolName?.tool_name;
      groupedData[dbToolId].categoryDetail = categoryDetail;
      groupedData[dbToolId].ui_display = dbToolName?.ui_display;
    })
  );

  // Convert the grouped object to an array
  return Object.values(groupedData);
};
