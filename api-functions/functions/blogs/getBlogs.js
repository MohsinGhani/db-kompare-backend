import {
  fetchAllItemByDynamodbIndex,
  getItem,
} from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { status, databases, isPublished } =
      event.queryStringParameters || {};

    // Validate input: Return error if both `status` and `isPublished` are passed
    if (status && isPublished) {
      return sendResponse(
        400,
        "You cannot pass both 'status' and 'isPublished' together."
      );
    }

    let IndexName = null;
    let KeyConditionExpression = null;
    const ExpressionAttributeValues = {};
    const ExpressionAttributeNames = {};
    let FilterExpression = null;

    // Handle `status`
    if (status) {
      IndexName = "byStatus";
      KeyConditionExpression = "#status = :status";
      ExpressionAttributeValues[":status"] = status;
      ExpressionAttributeNames["#status"] = "status";
    }

    // Handle `isPublished`
    if (isPublished) {
      IndexName = "byIsPublished";
      KeyConditionExpression = "#isPublished = :isPublished";
      ExpressionAttributeValues[":isPublished"] = isPublished;
      ExpressionAttributeNames["#isPublished"] = "isPublished";
    }

    // Handle `databases` as a filter expression
    if (databases) {
      const dbArray = databases.split(",");
      const filterConditions = dbArray.map(
        (db, index) => `contains(#databases, :database${index})`
      );
      const dbFilter = filterConditions.join(" OR ");
      dbArray.forEach((db, index) => {
        ExpressionAttributeValues[`:database${index}`] = db.trim();
      });
      ExpressionAttributeNames["#databases"] = "databases";

      // Combine with existing filter expression if present
      FilterExpression = FilterExpression
        ? `${FilterExpression} AND (${dbFilter})`
        : dbFilter;
    }

    // Validate: At least one of `status` or `isPublished` must be provided
    if (!status && !isPublished) {
      return sendResponse(
        400,
        "Either 'status' or 'isPublished' must be provided"
      );
    }

    const blogs = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.BLOGS,
      IndexName,
      KeyConditionExpression,
      ExpressionAttributeValues,
      FilterExpression,
      ExpressionAttributeNames,
    });

    const blogsData = await Promise.all(
      blogs.map(async (blog) => {
        const user = await getUserById(blog.createdBy);
        return { ...blog, createdBy: user };
      })
    );

    return sendResponse(200, "Blogs retrieved successfully", blogsData);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};

// Get user
const getUserById = async (userId) => {
  const key = {
    id: userId,
  };
  try {
    const result = await getItem(TABLE_NAME.USERS, key);
    if (result.Item) {
      return result.Item;
    }

    console.log("🚀 ~ result.Item:", result.Item);

    return "ANONYMOUS"; // Fallback if the user name is not found
  } catch (error) {
    console.error(`Error fetching user for ID ${userId}:`, error);
    throw error;
  }
};
