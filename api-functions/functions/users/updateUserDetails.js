import { adminUpdateUserAttributes } from "../../helpers/auth.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { getItem, updateItemInDynamoDB } from "../../helpers/dynamodb.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event, context, callback) => {
  const { id, name, gender, aboutMe, city, country, skills, email } =
    JSON.parse(event.body);

  const { COGNITO_USER_POOL_ID } = process.env;
  console.log("id", id, COGNITO_USER_POOL_ID);
  try {
    const { Item: user } = await getItem(TABLE_NAME.USERS, {
      id: id,
    });
    console.log("user", user);

    if (!user) {
      return context.fail("User doesn't exist!");
    }

    let updateExpression = "SET updatedAt = :updatedAt";
    let expressionAttributeValues = {
      ":updatedAt": getTimestamp(),
    };

    let expressionAttributeNames = name
      ? {
          "#name": "name", // Alias for the reserved keyword "name"
        }
      : null;

    if (name) {
      updateExpression += ", #name = :name";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":name": name,
      };
    }

    if (aboutMe) {
      updateExpression += ", aboutMe = :aboutMe";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":aboutMe": aboutMe,
      };
    }
    if (city) {
      updateExpression += ", city = :city";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":city": city,
      };
    }

    if (email) {
      updateExpression += ", email = :email";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":email": email,
      };
    }

    if (country) {
      updateExpression += ", country = :country";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":country": country,
      };
    }

    if (skills) {
      updateExpression += ", skills = :skills";
      expressionAttributeValues = {
        ...expressionAttributeValues,
        ":skills": skills,
      };
    }

    if (gender) {
      updateExpression += ", gender = :gender";
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
      Key: { id: id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames, // Add ExpressionAttributeNames here
      ConditionExpression: "attribute_exists(id)",
    });

    return sendResponse(200, "User Updated Successfully", Attributes);
  } catch (error) {
    return sendResponse(500, "Server Error", error);
  }
};
