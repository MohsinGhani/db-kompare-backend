// import prismaReadOnly from "../../db/prismaReadOnly.js";

// export const handler = async (event) => {
//   const body = JSON.parse(event.body || "{}");
//   const { userId } = body;
//   console.log("userId", userId);

//   try {
//     const schemaName = `user_${userId}`;
//     console.log("Schema Name", schemaName);

//     // Step 1: Create the schema (if it doesn't exist)
//     await prismaReadOnly.$executeRawUnsafe(
//       `CREATE SCHEMA IF NOT EXISTS "${schemaName}";`
//     );

//     // Step 2: Check if the "products" table exists before creating it
//     const productsTableExists = await prismaReadOnly.$queryRawUnsafe(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_schema = '${schemaName}'
//         AND table_name = 'products'
//       );
//     `);
//     console.log("productsTableExists", productsTableExists);

//     if (!productsTableExists[0].exists) {
//       await prismaReadOnly.$executeRawUnsafe(`
//         CREATE TABLE "${schemaName}".products (
//           id SERIAL PRIMARY KEY,
//           name TEXT
//         );
//       `);
//     }

//     // Step 3: Check if the "users" table exists before creating it
//     const usersTableExists = await prismaReadOnly.$queryRawUnsafe(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_schema = '${schemaName}'
//         AND table_name = 'users'
//       );
//     `);

//     if (!usersTableExists[0].exists) {
//       await prismaReadOnly.$executeRawUnsafe(`
//         CREATE TABLE "${schemaName}".users (
//           id SERIAL PRIMARY KEY,
//           email TEXT
//         );
//       `);
//     }

//     console.log(`Schema and tables created for user: ${userId}`);
//     return {
//       statusCode: 200,
//       body: JSON.stringify({
//         message: "Schema and tables created successfully",
//       }),
//     };
//   } catch (error) {
//     console.error("Error creating schema and tables:", error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: "Failed to create schema and tables" }),
//     };
//   } finally {
//     await prismaReadOnly.$disconnect();
//   }
// };

// pages/api/submit-question.ts (Next.js API Route) or some-lambda.ts

import prismaReadOnly from "../../db/prismaReadOnly.js";
import prismaCommonClient from "../../db/prismaCommonClient.js";
const ques = {
  title: "Page With No Likes - Facebook SQL Interview Question",
  shortTitle: "No Likes Query",
  description:
    "### Page With No Likes\n\nAssume you are given two tables that store information about Facebook Pages and the likes they receive (i.e. when a user *likes* a Facebook Page).\n\nWrite a SQL query that returns the IDs of the Facebook pages which have received **zero likes**. Your output should list the page IDs in ascending order.\n\n#### `pages` Table:\n\n| **Column Name** | **Type**  |\n| --------------- | --------- |\n| page_id         | integer   |\n| page_name       | varchar   |\n\n**Example Input for `pages` Table:**\n\n| **page_id** | **page_name**          |\n| ----------- | ---------------------- |\n| 20001       | SQL Solutions          |\n| 20045       | Brain Exercises        |\n| 20701       | Tips for Data Analysts |\n\n#### `page_likes` Table:\n\n| **Column Name** | **Type**    |\n| --------------- | ----------- |\n| user_id         | integer     |\n| page_id         | integer     |\n| liked_date      | datetime    |\n\n**Example Input for `page_likes` Table:**\n\n| **user_id** | **page_id** | **liked_date**         |\n| ----------- | ----------- | ---------------------- |\n| 111         | 20001       | 04/08/2022 00:00:00     |\n| 121         | 20045       | 03/12/2022 00:00:00     |\n| 156         | 20001       | 07/25/2022 00:00:00     |\n\n#### Expected Output:\n\n| **page_id** |\n| ----------- |\n| 20701       |\n\n**Note:** The dataset you query against may differ; this is just an illustrative example. If you need a refresher on SQL basics, consider checking out our [free SQL tutorial](https://datalemur.com/sql-tutorial).",
  difficulty: "EASY",
  category: "SQL",
  supportedRuntime: "POSTGRES",
  solutionExplanation:
    "### Explanation\n\nThere are several methods to solve this problem:\n\n1. **Using EXCEPT:**\n   - **Step 1:** Select all page IDs from the `pages` table.\n   - **Step 2:** Select all page IDs from the `page_likes` table.\n   - **Step 3:** Use the `EXCEPT` operator to subtract the second result from the first, yielding the page IDs with zero likes.\n\n2. **Using LEFT JOIN:**\n   - Perform a LEFT JOIN between `pages` and `page_likes` on the `page_id` column.\n   - Filter the results where the `page_likes` columns are `NULL` (indicating no likes).\n\n3. **Using NOT IN:**\n   - Select page IDs from the `pages` table where the `page_id` is not found in the list of page IDs from the `page_likes` table.\n\nAll approaches should produce the list of page IDs with no likes, sorted in ascending order.",
  baseQuery: "SELECT * FROM page_likes;",
  seoDescription: "Facebook SQL Interview Question: Page With No Likes",
  questionType: "INTERVIEW",
  lessonId: null,
  companyId: 1,
  tags: [1],
  access: "read-onlyy",
};

export const handler = async (req, res) => {
  try {
    const { questionType, sqlQuery } = JSON.parse(req.body || {});
    // questionType could be "READONLY" or "READWRITE" (or something similar)

    // 1. Pick the client
    let client;
    if (ques.access === "read-only") {
      client = prismaReadOnly;
    } else {
      client = prismaCommonClient;
    }
    // 2. Run the query (or a Prisma query)
    // For raw SQL:
    const results = await client.$queryRawUnsafe(sqlQuery);
    // or for a model-based query:
    // const results = await client.product.findMany();

    // 3. Return the result to the frontend
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: results,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message }),
    };
  }
};
