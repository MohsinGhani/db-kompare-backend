import https from "https";

function getGitHubUser(token) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: "api.github.com",
      path: "/user",
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/json",
        "User-Agent": "nodejs-lambda",
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`GitHub /user returned ${res.statusCode}: ${data}`)
          );
        }
        try {
          const userData = JSON.parse(data);
          resolve(userData);
        } catch (err) {
          reject(new Error("Failed to parse /user response from GitHub"));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function getGitHubUserByUsername(token, username) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: "api.github.com",
      path: `/user/${username}`,
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/json",
        "User-Agent": "nodejs-lambda",
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`GitHub /user returned ${res.statusCode}: ${data}`)
          );
        }
        try {
          const userData = JSON.parse(data);
          resolve(userData);
        } catch (err) {
          reject(new Error("Failed to parse /user response from GitHub"));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function getGitHubUserEmails(token) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: "api.github.com",
      path: "/user/emails",
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/json",
        "User-Agent": "nodejs-lambda",
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`GitHub /user/emails returned ${res.statusCode}: ${data}`)
          );
        }
        try {
          const emails = JSON.parse(data);
          resolve(emails);
        } catch (err) {
          reject(new Error("Failed to parse /user/emails response"));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

export const handler = async (event, context, callback) => {
  try {
    const headers = event.headers || {};
    const authHeader = headers.Authorization || "";
    const token = authHeader.replace("Bearer ", "");

    // 1) Get basic user info
    const userData = await getGitHubUser(token);

    // 2) If email is null or missing, do a second call to /user/emails
    if (!userData.email) {
      const emails = await getGitHubUserEmails(token);
      // Look for primary or the first verified email
      const primaryEmailObj =
        emails.find((e) => e.primary && e.verified) || emails[0];
      if (primaryEmailObj && primaryEmailObj.email) {
        userData.email = primaryEmailObj.email;
      }
    }

    if (!userData.name) {
      userData.name = userData.login || `GitHubUser_${userData.id}`;
    }

    // 3) Assign sub = user ID
    userData.sub = userData.id;
    console.log("userData", JSON.stringify(userData));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    };
  } catch (error) {
    console.error("Error fetching user info from GitHub:", error);
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "invalid_request",
        error_description: error.message,
      }),
    };
  }
};
