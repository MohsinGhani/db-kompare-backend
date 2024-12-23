import { adminUpdateUserAttributes } from "../../helpers/auth.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem, updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event, context, callback) => {
  const { id, name, gender, aboutMe, city, country, skills } = JSON.parse(
    event.body
  );

  const { COGNITO_USER_POOL_ID } = process.env;

  try {
    const { Item: user } = await getItem(TABLE_NAME.USERS, {
      id: id,
    });

    if (!user) {
      return sendResponse(404, "User does not exist", null);
    }

    let updateExpression =
      "SET name = :name, aboutMe = :aboutMe, city = :city, country = :country, updatedAt = :updatedAt, ";
    let expressionAttributeValues = {
      ":name": name,
      ":updatedAt": getTimestamp(),
    };

    if (aboutMe) {
      updateExpression += "aboutMe = :aboutMe, ";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":aboutMe": aboutMe,
      };
    }
    if (city) {
      updateExpression += "city = :city, ";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":city": city,
      };
    }
    if (country) {
      updateExpression += "country = :country, ";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":country": country,
      };
    }

    if (skills) {
      updateExpression += "skills = :skills, ";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":skills": skills,
      };
    }

    if (gender) {
      updateExpression += "gender = :gender, ";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":gender": gender,
      };
    }

    if (user && name) {
      await adminUpdateUserAttributes(
        user.cognitoId,
        [{ Name: "name", Value: name }],
        COGNITO_USER_POOL_ID
      );
    }

    let { Attributes } = await updateItemInDynamoDB({
      table: TABLE_NAME.USERS,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: "attribute_exists(id)",
    });

    return sendResponse(200, "User updated", Attributes);
  } catch (error) {
    return sendResponse(500, "Server Error", error);
  }
};
