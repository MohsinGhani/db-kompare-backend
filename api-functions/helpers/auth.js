import AWS from "aws-sdk";
import { getItem } from "./dynamodb.js";

const serviceProvider = new AWS.CognitoIdentityServiceProvider();

export const adminConfirmSignUp = (Username, userPoodId) => {
  return new Promise((res, rej) => {
    serviceProvider.adminConfirmSignUp(
      {
        UserPoolId: userPoodId,
        Username,
      },
      (error, data) => {
        console.log("=> adminConfirmSignUp callback");
        if (error) {
          console.log("=> error", JSON.stringify(error));
          rej(error);
        } else {
          console.log(
            "=> Admin Confirm SignUp successful!",
            JSON.stringify(data)
          );
          res(data);
        }
      }
    );
  });
};

export const adminGetUser = (Username, userPoodId) => {
  return serviceProvider
    .adminGetUser({
      UserPoolId: userPoodId,
      Username,
    })
    .promise();
};

export const resendConfirmationCode = (Username, userPoodId) => {
  return serviceProvider
    .resendConfirmationCode({
      ClientId: userPoodId,
      Username,
    })
    .promise();
};

export const adminForgetUserDevice = (params) => {
  return serviceProvider.adminForgetDevice(params).promise();
};

export const isUserExistInCognito = (Username, userPoodId) => {
  return new Promise((res, rej) => {
    serviceProvider.adminGetUser(
      {
        UserPoolId: userPoodId,
        Username,
      },
      (error, data) => {
        console.log("error", JSON.stringify(error));
        console.log("data", JSON.stringify(data));
        error ? res(false) : res(true);
      }
    );
  });
};

export const adminUpdateUserAttributes = (Username, attributes, userPoodId) => {
  return new Promise((res, rej) => {
    serviceProvider.adminUpdateUserAttributes(
      {
        UserPoolId: userPoodId,
        UserAttributes: attributes,
        Username,
      },
      (error, data) => {
        if (error) {
          console.log("error", error);
          rej(error);
        } else {
          console.log(Username, "Admin Update User Attributes successful!");
          res(Username);
        }
      }
    );
  });
};

export const disableCognitoUser = (userId, userPoolId) => {
  return new Promise((res, rej) => {
    serviceProvider.adminDisableUser(
      {
        UserPoolId: userPoolId,
        Username: userId,
      },
      (error, data) => {
        if (error) {
          console.log("error", error);
          rej(error);
        } else {
          console.log(userId, "disable successful!");
          res(userId);
        }
      }
    );
  });
};

export const enableCognitoUser = (userId, userPoolId) => {
  return new Promise((res, rej) => {
    getItem("User", { userId })
      .then((data) => {
        const { email, userRole, type, userStatus } = data["Item"];
        if (userStatus === "FORCE_CHANGE_PASSWORD") {
          createCognitoUser(email, userRole, type, "RESEND")
            .then(() => {
              serviceProvider.adminEnableUser(
                {
                  UserPoolId: userPoolId,
                  Username: userId,
                },
                (error, data) => {
                  if (error) {
                    console.log("error", error);
                    rej(error);
                  } else {
                    console.log(userId, "enable successful!");
                    res(userId);
                  }
                }
              );
            })
            .catch((error) => {
              rej(error);
            });
        } else {
          serviceProvider.adminEnableUser(
            {
              UserPoolId: userPoolId,
              Username: userId,
            },
            (error, data) => {
              if (error) {
                console.log("error", error);
                rej(error);
              } else {
                console.log(userId, "enable successful!");
                res(userId);
              }
            }
          );
        }
      })
      .catch((error) => {
        rej(error);
      });
  });
};

export const enableCognitoUserWithoutDB = (userId, userPoolId) => {
  return new Promise((res, rej) => {
    serviceProvider.adminEnableUser(
      {
        UserPoolId: userPoolId,
        Username: userId,
      },
      (error, data) => {
        if (error) {
          console.log("error", error);
          rej(error);
        } else {
          console.log(userId, "enable successful!");
          res(userId);
        }
      }
    );
  });
};

export const createCognitoUser = (
  Username,
  UserAttributes,
  userPoolId,
  messageAction,
  tempPassword
) => {
  let authenticationData = {
    UserPoolId: userPoolId,
    Username,
    DesiredDeliveryMediums: ["EMAIL"],
    UserAttributes,
  };
  if (messageAction) authenticationData["MessageAction"] = messageAction;
  if (tempPassword) authenticationData["TemporaryPassword"] = tempPassword;

  console.log("authenticationData", JSON.stringify(authenticationData));
  return serviceProvider.adminCreateUser(authenticationData).promise();
};

export const deleteCognitoUser = (Username, userPoolId) => {
  let authenticationData = {
    UserPoolId: userPoolId,
    Username,
  };

  console.log("authenticationData", JSON.stringify(authenticationData));
  return serviceProvider.adminDeleteUser(authenticationData).promise();
};

export const addUserToGroup = (Username, group, userPoolId) => {
  const params = {
    GroupName: group,
    UserPoolId: userPoolId,
    Username: Username,
  };

  return serviceProvider.adminAddUserToGroup(params).promise();
};

export const setTempPasswordForCognitoUser = (
  Username,
  Password,
  Permanent,
  userPoolId
) => {
  let authenticationData = {
    Password,
    Permanent,
    UserPoolId: userPoolId,
    Username,
  };

  return new Promise((res, rej) => {
    serviceProvider.adminSetUserPassword(authenticationData, (err, data) => {
      if (err) {
        console.log("err", err);
        rej(err);
      } else {
        res(data);
      }
    });
  });
};

export const listAllUser = (USER_POOL_ID, filter) => {
  const payload = {
    UserPoolId: USER_POOL_ID,
  };
  if (filter) {
    payload["Filter"] = filter;
  }
  return serviceProvider.listUsers(payload).promise();
};

export const listAllUsers = async (USER_POOL_ID) => {
  let allUsers = [];
  let paginationToken = null;

  do {
    const params = {
      UserPoolId: USER_POOL_ID,
      PaginationToken: paginationToken,
    };

    const result = await serviceProvider.listUsers(params).promise();

    allUsers = allUsers.concat(result.Users);
    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return allUsers;
};
