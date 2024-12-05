import { createItemInDynamoDB } from "../lib/dynamodb";
import { USER_STATUS, USER_ROLE, TABLE_NAME } from "../lib/constants";
import { v4 as uuidv4 } from "uuid";

import { addUserToGroup, adminUpdateUserAttributes } from "../lib/auth";

const { COGNITO_USER_POOL_ID } = process.env;

export const handler = async (event, context, callback) => {
  console.log("Received event:", JSON.stringify(event));

  const uniqueId = uuidv4();

  // Check if the trigger source is PostConfirmation (user confirmed sign-up)
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return callback(null, event);
  }

  let social_identity = event.request.userAttributes.identities;
  console.log("Social identity:", JSON.stringify(social_identity));

  if (social_identity) {
    social_identity = JSON.parse(social_identity);
    social_identity = social_identity[0]; // Handle the first social identity (e.g., Google)
  }

  const userAttributes = event.request.userAttributes;
  const userId = uniqueId;
  let role = userAttributes["custom:role"] || USER_ROLE.VENDOR; // Default to 'VENDOR' role if not set
  const { email, name, sub } = userAttributes; // Extract email, name, and user sub (Cognito ID)
  const loggedAt = new Date().toISOString(); // Get the timestamp of when the user confirmed

  // Prepare attributes for updating the user's custom fields in Cognito
  const attributesToUpdate = [
    { Name: "custom:userId", Value: userId },
    { Name: "custom:role", Value: role },
  ];

  // Handle Google sign-up or any social provider
  if (social_identity && social_identity.providerName === "Google") {
    console.log("Google user detected, setting role to VENDOR.");
    role = USER_ROLE.VENDOR;
    attributesToUpdate.push({ Name: "email_verified", Value: "true" }); // Mark email as verified for Google users
  }

  console.log("User role after processing:", role);

  try {
    // Create the user in DynamoDB with the necessary attributes
    const payload = {
      id: userId,
      cognitoId: sub, // Cognito user ID
      email,
      name,
      role,
      status: USER_STATUS.ACTIVE, // Set the user's status to ACTIVE
      loggedAt, // Store the timestamp when the user confirmed
    };

    // Store the new user record in DynamoDB
    await createItemInDynamoDB(
      payload,
      TABLE_NAME.USERS, // DynamoDB Table Name
      { "#id": "id" },
      "attribute_not_exists(#id)" // Prevent overwriting existing users
    );

    // Determine the appropriate Cognito group based on the user's role
    const groupName = role === USER_ROLE.ADMIN ? "Admins" : "Vendors";
    console.log(`Adding user to Cognito group: ${groupName}`);

    // Add the user to the appropriate Cognito group
    await addUserToGroup(sub, groupName, COGNITO_USER_POOL_ID);

    // Update Cognito attributes with the userId and role
    await adminUpdateUserAttributes(
      sub,
      attributesToUpdate,
      COGNITO_USER_POOL_ID
    );

    console.log(
      `User with ID ${userId} successfully added to DynamoDB and Cognito group ${groupName}`
    );

    // Return the event back to Cognito
    return callback(null, event);
  } catch (error) {
    console.error("Error during post-confirmation process:", error);
    return callback(error.message, event); // Pass error message back to Cognito
  }
};
