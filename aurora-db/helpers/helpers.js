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
  return `${title}-223`;
};

export const getTableName = (name) => {
  return `${name}`;
};

export const safeSerialize = (data) =>
  JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
export const getTimestamp = () => {
  return new Date().getTime();
};

export const formatDateLocal = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  // getMonth() returns 0-indexed months, so add 1 and pad if needed
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};
