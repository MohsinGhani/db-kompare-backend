import { fetchAllItemByDynamodbIndex } from "../../helpers/dynamodb.js";
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

    return sendResponse(200, "Blogs retrieved successfully", blogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
