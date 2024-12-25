import {
  fetchAllItemByDynamodbIndex,
  getItem,
} from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { status, databases } = event.queryStringParameters || {};

    const KeyConditionExpression = status ? "#status = :status" : null;
    const ExpressionAttributeValues = {};
    const ExpressionAttributeNames = {};

    if (status) {
      ExpressionAttributeValues[":status"] = status;
      ExpressionAttributeNames["#status"] = "status";
    }

    let FilterExpression = null;
    if (databases) {
      const dbArray = databases.split(",");
      const filterConditions = dbArray.map(
        (db, index) => `contains(#databases, :database${index})`
      );
      FilterExpression = filterConditions.join(" OR ");
      dbArray.forEach((db, index) => {
        ExpressionAttributeValues[`:database${index}`] = db.trim();
      });
      ExpressionAttributeNames["#databases"] = "databases";
    }

    const blogs = await fetchAllItemByDynamodbIndex({
      TableName: TABLE_NAME.BLOGS,
      IndexName: "byStatus",
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

    return "ANONYMOUS"; // Fallback if the database name is not found
  } catch (error) {
    console.error(`Error fetching database name for ID ${userId}:`, error);
    throw error;
  }
};
