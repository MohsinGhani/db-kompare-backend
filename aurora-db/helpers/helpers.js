import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Initialize a lightweight S3 client
const s3Client = new S3Client({});

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
// LOAD INPUT FROM S3 KEY OR RAW DATA
// ==============================
async function loadInput(input, asJson = false) {
  if (typeof input === "string" && process.env.BUCKET_NAME) {
    const Bucket = process.env.BUCKET_NAME;
    const Key = `${input}`;
    const command = new GetObjectCommand({ Bucket, Key });
    const { Body } = await s3Client.send(command);

    const chunks = [];
    for await (const chunk of Body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString("utf-8");
    return asJson ? JSON.parse(text) : text;
  }

  return input;
}

// ==============================
// CONVERT TABLE NAME TO SNAKE CASE
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
// PARSE DELIMITED LINE (CSV/PSV)
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
// FLATTEN RECORD (for JSON)
// ==============================
function flattenRecord(obj, prefix = "") {
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
function buildPgSql(tableName, records) {
  if (!records.length) return { output: "" };

  const tbl = sanitizeIdentifier(tableName).toLowerCase();
  const colSet = new Set();
  records.forEach((rec) => Object.keys(rec).forEach((k) => colSet.add(k)));
  const columns = Array.from(colSet);

  const columnTypes = {};
  columns.forEach((col) => {
    let detected = null;
    let maxLen = 0;
    let allInt = true;
    let allBool = true;

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

    if (detected === "boolean" && allBool) {
      columnTypes[col] = "BOOLEAN";
    } else if (detected === "number") {
      columnTypes[col] = allInt ? "INTEGER" : "NUMERIC";
    } else if (detected === "string") {
      columnTypes[col] =
        maxLen > 0 ? `VARCHAR(${Math.max(maxLen, 100)})` : "TEXT";
    } else {
      columnTypes[col] = "TEXT";
    }
  });

  const createTableStatement =
    `CREATE TABLE ${tbl} (\n  ` +
    columns.map((c) => `${c} ${columnTypes[c]}`).join(",\n  ") +
    `\n);\n\n`;

  let insertStatements = "";
  records.forEach((rec) => {
    const vals = columns
      .map((col) => {
        const v = rec[col];
        if (v == null || v === "") return "NULL";
        if (typeof v === "boolean" || typeof v === "number") return v;
        const s = String(v);
        if (["true", "false"].includes(s.toLowerCase())) return s.toLowerCase();
        return `'${s.replace(/'/g, "''")}'`;
      })
      .join(", ");
    insertStatements += `INSERT INTO ${tbl} (${columns.join(
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
// JSON to PGSQL Conversion (limited to 10000 records)
// ==============================
export async function jsonToPgsql(input, tableName = "my_table") {
  const jsonData = await loadInput(input, true);
  const raw = Array.isArray(jsonData) ? jsonData : [jsonData];
  const limited = raw.slice(0, 10000);
  const records = limited.map((o) => flattenRecord(o));
  return buildPgSql(tableName, records);
}

// ==============================
// DELIMITED to PGSQL Conversion (limited to 10000 records)
// ==============================
export async function delimitedToPgsql(
  input,
  tableName = "my_table",
  delimiter = ","
) {
  const rawData = await loadInput(input, false);
  const lines = String(rawData)
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (!lines.length) return { output: "" };

  const headers = parseDelimitedLine(lines.shift(), delimiter).map(
    sanitizeIdentifier
  );
  const records = lines.map((line) => {
    const fields = parseDelimitedLine(line, delimiter);
    const rec = {};
    headers.forEach((h, i) => {
      rec[h] = fields[i] !== undefined ? fields[i].trim() : null;
    });
    return rec;
  });
  const limitedRecords = records.slice(0, 10000);
  return buildPgSql(tableName, limitedRecords);
}

// Convenience wrappers
export const csvToPgsql = (input, tbl) => delimitedToPgsql(input, tbl, ",");
export const pipeToPgsql = (input, tbl) => delimitedToPgsql(input, tbl, "|");
