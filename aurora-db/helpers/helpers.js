import slugify from "slugify";

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

export const generateSlug = (title) => {
  return slugify(title, {
    lower: true,
    strict: true, // remove special chars
  });
};
