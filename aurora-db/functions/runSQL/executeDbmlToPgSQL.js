import { exporter } from "@dbml/core";
import { executeCommonQuery } from "../../db/index.js";

export const handler = async (event) => {
  try {
    // Parse the DBML from the request body.
    const { dbml } = JSON.parse(event.body);

    // Convert DBML to PostgreSQL SQL using the @dbml/core package.
    const sql = exporter.export(dbml, "postgres");

    // Execute the generated SQL to create the tables.
    await executeCommonQuery(sql);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Tables created successfully", sql }),
    };
  } catch (error) {
    console.error("Error creating tables:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create tables" }),
    };
  }
};
