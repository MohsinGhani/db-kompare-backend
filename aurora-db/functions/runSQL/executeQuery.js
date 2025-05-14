import { executeUserQuery } from "../../db/index.js";
import {
  csvToPgsql,
  jsonToPgsql,
  pipeToPgsql,
  sendResponse,
} from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const {
      userId: user_id,
      query: rawQuery,
      fileType,
      url_KEY,
      tableName,
      fileExtension,
    } = JSON.parse(event.body || "{}");

    let userId = user_id || "common";

    let sqlToRun;

    // 1️⃣ If the client sent a SQL query, use it
    if (rawQuery && rawQuery.trim() !== "") {
      sqlToRun = rawQuery.trim();

      // 2️⃣ Otherwise, if they provided an S3 URL payload, convert it
    } else if (url_KEY && fileType && tableName) {
      const url = `TEMP/${url_KEY}.${fileExtension}`;

      // Conversion functions are async, so await their result
      let conversionResult;
      switch (fileType) {
        case "csv":
          conversionResult = await csvToPgsql(url, tableName);
          break;
        case "json":
          conversionResult = await jsonToPgsql(url, tableName);
          break;
        case "pipe":
          conversionResult = await pipeToPgsql(url, tableName);
          break;
        default:
          return sendResponse(400, "Invalid fileType", null);
      }

      sqlToRun = conversionResult.output?.trim();
      if (!sqlToRun) {
        return sendResponse(
          400,
          "Failed to generate SQL from provided file parameters",
          null
        );
      }

      // 3️⃣ Neither a query nor file info was supplied
    } else {
      return sendResponse(
        400,
        "Missing either raw SQL (`query`) or file parameters (`url_KEY`, `fileType`, `tableName`)",
        null
      );
    }

    console.log("SQL to run:", sqlToRun);

    // 4️⃣ Check if the SQL is empty or too long

    // Execute the selected SQL
    const result = await executeUserQuery(userId, sqlToRun);

    console.log("SQL execution result:", result);

    const payload = {
      data: result.rows,
      executionTime: result.executionTime,
      columns: result.columns,
    };
    return sendResponse(200, "Query executed successfully", payload);
  } catch (error) {
    console.error("Error executing handler:", error);
    return sendResponse(500, error.message || "Internal server error", null);
  }
};
