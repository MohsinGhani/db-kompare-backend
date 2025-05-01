import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import csvParser from "csv-parser";
import ParserModule from "stream-json/Parser.js";
import JSONLParserModule from "stream-json/jsonl/Parser.js";
import StreamArrayModule from "stream-json/streamers/StreamArray.js";
import StreamObjectModule from "stream-json/streamers/StreamObject.js";
import StreamValuesModule from "stream-json/streamers/StreamValues.js";
import { pipeline } from "stream/promises";
import { PassThrough } from "stream";

const { parser: jsonParser } = ParserModule;
const { parser: jsonlParser } = JSONLParserModule;
const { streamArray } = StreamArrayModule;
const { streamObject } = StreamObjectModule;
const { streamValues } = StreamValuesModule;

import { createInterface } from "readline";

// Initialize a lightweight S3 client
const s3Client = new S3Client({ region: "eu-west-1" });

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
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ==============================
// LOAD INPUT AS STREAM FROM S3
// ==============================
async function loadInputStream(key) {
  if (typeof key !== "string" || !process.env.BUCKET_NAME) {
    throw new Error("A valid S3 key string and BUCKET_NAME are required");
  }
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
  });
  const { Body } = await s3Client.send(command);
  // Body is a Node.js Readable stream
  return Body;
}

// ==============================
// SANITIZE IDENTIFIERS
// ==============================
export const sanitizeIdentifier = (identifier) => {
  let sanitized = identifier.toLowerCase();
  sanitized = sanitized.replace(/[^a-z0-9_]/g, "_");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^_+|_+$/g, "");
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`;
  if (sanitized === "") sanitized = "table";
  return sanitized;
};

// ==============================
// PARSE DELIMITED LINE
// ==============================
function parseDelimitedLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ==============================
// FLATTEN JSON RECORD
// ==============================
function flattenRecord(obj, prefix = "") {
  console.log("obj", obj);
  const result = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const sanitizedKey = sanitizeIdentifier(key);
    const newKey = `${prefix}${sanitizedKey}`;
    const val = obj[key];
    if (Array.isArray(val)) {
      val.forEach((el, idx) => {
        if (el && typeof el === "object") {
          Object.assign(result, flattenRecord(el, `${newKey}${idx}_`));
        } else {
          result[`${newKey}${idx}`] = el;
        }
      });
    } else if (val && typeof val === "object") {
      Object.assign(result, flattenRecord(val, `${newKey}_`));
    } else {
      result[newKey] = val;
    }
  }
  return result;
}

// ==============================
// BUILD PGSQL STATEMENTS
// ==============================
// function buildPgSql(tableName, records) {
//   if (!records.length) return { output: "" };
//   console.log("records", records);
//   const tbl = sanitizeIdentifier(tableName).toLowerCase();
//   const colSet = new Set();
//   records.forEach((rec) => Object.keys(rec).forEach((k) => colSet.add(k)));
//   const columns = Array.from(colSet);
//   console.log("columns", columns);
//   const columnTypes = {};
//   columns.forEach((col) => {
//     let detected = null;
//     let maxLen = 0;
//     let allInt = true;
//     let allBool = true;

//     records.forEach((rec) => {
//       const v = rec[col];
//       if (v == null) return;
//       if (typeof v === "boolean") {
//         detected = "boolean";
//       } else if (typeof v === "number") {
//         detected = "number";
//         if (!Number.isInteger(v)) allInt = false;
//       } else {
//         detected = "string";
//         const s = String(v);
//         maxLen = Math.max(maxLen, s.length);
//         if (!["true", "false"].includes(s.toLowerCase())) allBool = false;
//       }
//     });

//     if (detected === "boolean" && allBool) {
//       columnTypes[col] = "BOOLEAN";
//     } else if (detected === "number") {
//       columnTypes[col] = allInt ? "INTEGER" : "NUMERIC";
//     } else if (detected === "string") {
//       columnTypes[col] =
//         maxLen > 0 ? `VARCHAR(${Math.max(maxLen, 100)})` : "TEXT";
//     } else {
//       columnTypes[col] = "TEXT";
//     }
//   });

//   const createTableStatement =
//     `CREATE TABLE ${tbl} (\n  ` +
//     columns.map((c) => `${c} ${columnTypes[c]}`).join(",\n  ") +
//     `\n);\n\n`;

//   let insertStatements = "";
//   records.forEach((rec) => {
//     const vals = columns
//       .map((col) => {
//         const v = rec[col];
//         if (v == null || v === "") return "NULL";
//         if (typeof v === "boolean" || typeof v === "number") return v;
//         const s = String(v);
//         if (["true", "false"].includes(s.toLowerCase())) return s.toLowerCase();
//         return `'${s.replace(/'/g, "''")}'`;
//       })
//       .join(", ");
//     insertStatements += `INSERT INTO ${tbl} (${columns.join(
//       ", "
//     )}) VALUES (${vals});\n`;
//   });

//   return {
//     output: createTableStatement + insertStatements,
//     createTableStatement,
//     insertStatements,
//   };
// }
function buildPgSql(tableName, records) {
  if (!records.length) return { output: "" };

  // sanitizeIdentifier should strip out bad chars but NOT quote.
  // we’ll add quoting here.
  const tbl = sanitizeIdentifier(tableName);

  // collect all column names
  const colSet = new Set();
  records.forEach((rec) => Object.keys(rec).forEach((k) => colSet.add(k)));
  const columns = Array.from(colSet);

  // infer types as before...
  const columnTypes = {};
  columns.forEach((col) => {
    let detected = null,
      maxLen = 0,
      allInt = true,
      allBool = true;
    records.forEach((rec) => {
      const v = rec[col];
      if (v == null) return;
      if (typeof v === "boolean") {
        detected = "boolean";
      } else if (typeof v === "number") {
        detected = "number";
        if (!Number.isInteger(v)) allInt = false;
      } else {
        detected = "string";
        const s = String(v);
        maxLen = Math.max(maxLen, s.length);
        if (!["true", "false"].includes(s.toLowerCase())) allBool = false;
      }
    });

    if (detected === "boolean" && allBool) columnTypes[col] = "BOOLEAN";
    else if (detected === "number")
      columnTypes[col] = allInt ? "INTEGER" : "NUMERIC";
    else if (detected === "string")
      columnTypes[col] = `VARCHAR(${Math.max(maxLen, 100)})`;
    else columnTypes[col] = "TEXT";
  });

  // Quote the table and each column name
  const qTbl = `"${tbl}"`;
  const qCols = columns.map((c) => `"${c}"`);

  // CREATE TABLE
  const createTableStatement =
    `CREATE TABLE ${qTbl} (\n  ` +
    columns.map((c) => `"${c}" ${columnTypes[c]}`).join(",\n  ") +
    `\n);\n\n`;

  // INSERTs
  let insertStatements = "";
  records.forEach((rec) => {
    const vals = columns
      .map((col) => {
        const v = rec[col];
        if (v == null || v === "") return "NULL";
        if (typeof v === "boolean" || typeof v === "number") return v;
        const s = String(v).replace(/'/g, "''");
        // note: we let 'true'/'false' remain unquoted if they parse as booleans
        if (["true", "false"].includes(s.toLowerCase())) return s.toLowerCase();
        return `'${s}'`;
      })
      .join(", ");

    insertStatements += `INSERT INTO ${qTbl} (${qCols.join(
      ", "
    )}) VALUES (${vals});\n`;
  });

  return {
    output: createTableStatement + insertStatements,
    createTableStatement,
    insertStatements,
  };
}

// ==============================
// JSON to PGSQL (streaming first 10000; auto-detect array vs NDJSON)
// ==============================
export async function jsonToPgsql(inputKey, tableName = "my_table") {
  // 1) Load the raw S3 stream
  const raw = await loadInputStream(inputKey);

  // 2) Peek one chunk to sample for NDJSON vs JSON array/object
  const peekBuf = await new Promise((resolve, reject) => {
    raw.once("error", reject);
    raw.once("data", (chunk) => {
      raw.pause();
      raw.removeListener("error", reject);
      resolve(chunk);
    });
  });

  // 3) Replay that chunk so we don't lose it
  const replay = new PassThrough();
  replay.write(peekBuf);
  raw.pipe(replay);

  // 4) Find the very first non-whitespace character
  const str = peekBuf.toString("utf8");
  const firstChar = str.match(/\S/)?.[0];
  if (!firstChar) throw new Error("Empty JSON input");

  // 5) Choose parser + unwrapper
  let parserStream, unwrapper;
  const ndjsonPattern = /\}\s*\n\s*\{/;
  if (firstChar === "[") {
    parserStream = jsonParser();
    unwrapper = streamArray();
  } else if (firstChar === "{" && ndjsonPattern.test(str)) {
    parserStream = jsonlParser();
    unwrapper = streamValues();
  } else if (firstChar === "{") {
    parserStream = jsonParser();
    unwrapper = streamObject();
  } else {
    throw new Error(`Unsupported JSON root character: ${firstChar}`);
  }

  // 6) Stream and flatten up to MAX records, then abort cleanly
  const records = [];
  const MAX = 10_000;

  // Use built-in AbortController to cancel pipeline when MAX reached
  const controller = new AbortController();
  const { signal } = controller;

  try {
    await pipeline(
      replay,
      parserStream,
      unwrapper,
      async function* (source) {
        for await (const { value } of source) {
          records.push(flattenRecord(value));
          if (records.length >= MAX) {
            controller.abort(); // signals pipeline to stop
            return; // end the async generator
          }
        }
      },
      { signal } // pass the AbortSignal into pipeline
    );
  } catch (err) {
    // Ignore the AbortError we expect, re-throw anything else
    const isAbort =
      err.name === "AbortError" || /premature close/i.test(err.message);
    if (!isAbort) throw err;
  }

  // 7) Build & return your SQL using exactly the records you collected
  return buildPgSql(tableName, records);
}

// ==============================
// DELIMITED to PGSQL (streaming first 10000)
// ==============================
export async function delimitedToPgsql(
  inputKey,
  tableName = "my_table",
  delimiter = ","
) {
  const stream = await loadInputStream(inputKey);
  return new Promise((resolve, reject) => {
    const records = [];
    let headers;
    let lineNumber = 0;
    const rl = createInterface({ input: stream });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      if (lineNumber === 0) {
        headers = parseDelimitedLine(line, delimiter).map(sanitizeIdentifier);
      } else if (records.length < 10000) {
        const fields = parseDelimitedLine(line, delimiter);
        const rec = {};
        headers.forEach((h, i) => {
          rec[h] = fields[i] !== undefined ? fields[i].trim() : null;
        });
        records.push(rec);
        if (records.length >= 10000) rl.close();
      }
      lineNumber++;
    });

    rl.on("close", () => resolve(buildPgSql(tableName, records)));
    rl.on("error", reject);
  });
}

// Convenience wrappers
export const csvToPgsql = (key, tbl) => delimitedToPgsql(key, tbl, ",");
export const pipeToPgsql = (key, tbl) => delimitedToPgsql(key, tbl, "|");
