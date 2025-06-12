import {
  createItemInDynamoDB,
  fetchAllItemByDynamodbIndex,
  getItem,
} from "../../helpers/dynamodb.js";
import { QUERY_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";
import { v4 as uuidv4 } from "uuid";

// FETCH ALL CATEGORIES
export const fetchAlldbToolsCategories = async () => {
  try {
    const params = {
      TableName: TABLE_NAME.CATEGORIES,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeValues: {
        ":status": QUERY_STATUS.ACTIVE,
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
    };

    return await fetchAllItemByDynamodbIndex(params);
  } catch (error) {
    console.log("Failed to get db tools categories", error.message);
    throw error;
  }
};

// GET CATEGORY ID BY NAME
export const getCategoryIdByName = async (categoryName) => {
  try {
    // Normalize the category name: trim spaces and convert to lowercase
    const normalizedCategoryName = categoryName.trim().toLowerCase();

    const params = {
      TableName: TABLE_NAME.CATEGORIES,
      IndexName: "byName",
      KeyConditionExpression: "#name = :name",
      ExpressionAttributeValues: {
        ":name": normalizedCategoryName,
      },
      ExpressionAttributeNames: {
        "#name": "name",
      },
    };

    const result = await fetchAllItemByDynamodbIndex(params);

    if (result && result.length > 0) {
      return result[0].id;
    } else {
      // If no category found, create a new one
      const newCategory = {
        id: uuidv4(),
        name: normalizedCategoryName, // Store in lowercase
        displayName: categoryName.trim(), // Preserve original for display
        createdAt: getTimestamp(),
        status: QUERY_STATUS.ACTIVE,
        description: "",
        parentId: null,
      };

      await createItemInDynamoDB(
        newCategory,
        TABLE_NAME.CATEGORIES,
        { "#id": "id", "#name": "name" },
        "attribute_not_exists(#id) AND attribute_not_exists(#name)", // Prevent duplicate names
        false
      );

      return newCategory.id;
    }
  } catch (error) {
    console.log("Failed to check category by name", error.message);
    return sendResponse(500, "Failed to check category by name", null);
  }
};

// GET CATEGORY BY ID
export const getCategoryById = async (categoryId) => {
  try {
    const result = await getItem(TABLE_NAME.CATEGORIES, { id: categoryId });
    if (result.Item) {
      return result.Item;
    } else {
      return null; // Category not found
    }
  } catch (error) {
    console.log("Failed to get category by ID", error.message);
    throw error;
  }
};

// CHECK IF CATEGORY EXISTS BY NAME
export const doesCategoryExistByName = async (categoryName) => {
  const id = await getCategoryIdByName(categoryName);
  return id !== null;
};
