import { TABLE_NAME } from "../../helpers/constants.js";
import { updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Parse the incoming request body
    const body = JSON.parse(event.body);

    const {
      id, // ID of the fiddle to update
      name,
      databaseType,
      query,
      dbStructure,
      tables,
    } = body;

    // Basic validation
    if (!id) {
      return sendResponse(400, "Missing 'id' for the fiddle to update.", null);
    }

    // Set the new updatedAt timestamp
    const updatedAt = getTimestamp();

    // Construct UpdateExpression
    // You can omit any fields you don't want to update or add ConditionExpressions as needed
    const UpdateExpression = `
      SET 
        #name = :name,
        #databaseType = :databaseType,
        #query = :query,
        #dbStructure = :dbStructure,
        #tables = :tables,
        #updatedAt = :updatedAt
    `;

    const ExpressionAttributeNames = {
      "#name": "name",
      "#databaseType": "databaseType",
      "#query": "query",
      "#dbStructure": "dbStructure",
      "#tables": "tables",
      "#updatedAt": "updatedAt",
    };

    const ExpressionAttributeValues = {
      ":name": name,
      ":databaseType": databaseType || "postgres",
      ":query": query || "",
      ":dbStructure": dbStructure || "",
      ":tables": tables || [],
      ":updatedAt": updatedAt,
    };

    // Optionally, ensure item already exists by adding a ConditionExpression
    // e.g., ConditionExpression: "attribute_exists(#id)"
    // Or ensure correct ownership by checking #ownerId = :ownerId
    // For now, we'll do a straightforward update
    const data = await updateItemInDynamoDB({
      table: TABLE_NAME.FIDDLES,
      Key: { id },
      UpdateExpression,
      ExpressionAttributeValues,
      ExpressionAttributeNames,
      // ConditionExpression: "attribute_exists(#id)", // Example if you want to ensure item exists
      // ExpressionAttributeNames: { ...ExpressionAttributeNames, "#id": "id" },
    });

    // The updated item is typically returned in data.Attributes if ReturnValues = "ALL_NEW"
    return sendResponse(200, "Fiddle updated successfully", data?.Attributes);
  } catch (error) {
    console.error("Error updating fiddle:", error);
    return sendResponse(500, error.toString(), null);
  }
};
