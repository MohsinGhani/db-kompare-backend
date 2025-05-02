import { TABLE_NAME } from "../../helpers/constants.js";
import {
  fetchAllItemByDynamodbIndex,
  getItem,
} from "../../helpers/dynamodb.js";
import { sendResponse } from "../../helpers/helpers.js";

const TABLE = TABLE_NAME.PROFILING;
const USER_INDEX = process.env.USER_INDEX || "byUser";
const FIDDLE_INDEX = process.env.FIDDLE_INDEX || "byFiddle";

// Fetch a single fiddle detail by ID
const getFiddleById = async (fiddleId) => {
  const result = await getItem(TABLE_NAME.FIDDLES, { id: fiddleId });
  return result.Item;
};

export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const userId = qs.userId;
  const fiddleId = qs.fiddleId;

  if (!userId && !fiddleId) {
    return sendResponse(
      400,
      "Missing userId or fiddleId in query parameters",
      null
    );
  }

  try {
    let items = [];

    // Retrieve profiling items based on query params
    if (userId && fiddleId) {
      const userItems = await fetchAllItemByDynamodbIndex({
        TableName: TABLE,
        IndexName: USER_INDEX,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      });
      items = userItems.filter((item) => item.fiddleId === fiddleId);
    } else if (userId) {
      items = await fetchAllItemByDynamodbIndex({
        TableName: TABLE,
        IndexName: USER_INDEX,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      });
    } else {
      items = await fetchAllItemByDynamodbIndex({
        TableName: TABLE,
        IndexName: FIDDLE_INDEX,
        KeyConditionExpression: "fiddleId = :f",
        ExpressionAttributeValues: { ":f": fiddleId },
      });
    }

    // Fetch and map fiddle details for each unique fiddleId
    const fiddleMap = {};
    await Promise.all(
      items.map(async (item) => {
        if (!fiddleMap[item.fiddleId]) {
          try {
            const detail = await getFiddleById(item.fiddleId);
            fiddleMap[item.fiddleId] = detail || {};
          } catch (err) {
            console.error(
              "Error fetching fiddle detail for",
              item.fiddleId,
              err
            );
            fiddleMap[item.fiddleId] = {};
          }
        }
      })
    );

    // Enrich profiling items with fiddleName, fileName, and fileExtension
    const enrichedItems = items.map((item) => {
      const fiddleDetail = fiddleMap[item.fiddleId] || {};
      let fileName = null;
      let fileExtension = null;

      if (item?.inputS3Key) {
        // 1) Get the last segment after the final slash
        const fullFilename = item.inputS3Key.substring(
          item.inputS3Key.lastIndexOf("/") + 1
        );
        // 2) Split name and extension at the last dot
        const dotIndex = fullFilename.lastIndexOf(".");
        const keyWithoutExt =
          dotIndex !== -1 ? fullFilename.substring(0, dotIndex) : fullFilename;
        const ext =
          dotIndex !== -1 ? fullFilename.substring(dotIndex + 1) : null;

        // 3) Find matching table entry by url_KEY
        const tableEntry =
          (fiddleDetail.tables || []).find(
            (t) => t.url_KEY === keyWithoutExt
          ) || {};

        fileName = tableEntry.fileName || null;
        fileExtension = tableEntry.fileExtension || ext;
      }

      return {
        ...item,
        fiddleName: fiddleDetail.name || null,
        fileName,
        fileExtension,
      };
    });

    return sendResponse(200, "Items fetched successfully", enrichedItems);
  } catch (error) {
    console.error("Error querying DynamoDB or fetching details:", error);
    return sendResponse(500, "Internal server error", null);
  }
};
