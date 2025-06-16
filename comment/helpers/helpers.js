import DynamoDB from "aws-sdk/clients/dynamodb.js";
const DynamoDBClient = new DynamoDB.DocumentClient();

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

export const getTableName = (name) => {
  return `${name}`;
};
export const getTimestamp = () => {
  return new Date().getTime();
};

export const getItem = (table, Key) => {
  const params = {
    TableName: table,
    Key,
  };
  return DynamoDBClient.get(params).promise();
};

export const getBatchItems = async (table, Keys) => {
  const promises = Keys.map(async (entityId) => {
    const params = {
      TableName: getTableName(table),
      IndexName: "byEntityId",
      KeyConditionExpression: "entityId = :entityId",
      ExpressionAttributeValues: {
        ":entityId": entityId,
      },
    };

    const result = await DynamoDBClient.query(params).promise();
    return result.Items;
  });

  const results = await Promise.all(promises);

  return results.flat();
};

export const createItemInDynamoDB = (
  itemAttributes,
  table,
  expressionAttributes,
  conditionExpression
) => {
  const tableParams = {
    Item: itemAttributes,
    TableName: getTableName(table),
    ExpressionAttributeNames: expressionAttributes,
    ConditionExpression: conditionExpression,
  };

  return DynamoDBClient.put(tableParams).promise();
};

export const updateItemInDynamoDB = ({
  table,
  Key,
  UpdateExpression,
  ExpressionAttributeValues,
  ReturnValues,
  ExpressionAttributeNames,
  ConditionExpression,
}) => {
  const params = {
    TableName: getTableName(table),
    Key,
    UpdateExpression,
    ExpressionAttributeValues,
    ReturnValues: ReturnValues || "ALL_NEW",
  };

  if (ExpressionAttributeNames) {
    params.ExpressionAttributeNames = ExpressionAttributeNames;
  }
  if (ConditionExpression) {
    params.ConditionExpression = ConditionExpression;
  }

  return DynamoDBClient.update(params).promise();
};
