import querystring from "querystring";
import https from "https";

export const handler = async (event, context, callback) => {
  const bodyString = event.body || "";
  const formData = querystring.parse(bodyString);

  const postData = querystring.stringify(formData);

  const requestOptions = {
    hostname: "github.com",
    path: "/login/oauth/access_token",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
    },
  };

  try {
    const responseJson = await new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(
                `GitHub token endpoint returned status ${res.statusCode}: ${data}`
              )
            );
          }
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            const parsed = querystring.parse(data);
            resolve(parsed);
          }
        });
      });

      req.on("error", (e) => reject(e));
      req.write(postData);
      req.end();
    });
    console.log("responseJson", JSON.stringify(responseJson));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseJson),
    };
  } catch (error) {
    console.error("Error exchanging code for token with GitHub:", error);
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
