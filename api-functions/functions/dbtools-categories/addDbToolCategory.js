import { batchWriteItems } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { DB_TOOL_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Parse the input JSON from the request body
    const categories = [
      {
        CategoryID: "4a090141-3d0d-4096-9358-aee3785fa979",
        Category: "Data Governance Tools",
        CategoryDescription:
          "data governance is a data management concept concerning the capability that enables an organization to ensure that high data quality exists throughout the complete lifecycle of the data, and data controls are implemented that support business objectives. The key focus areas of data governance include availability, usability, consistency, standards compliance, data integrity and security, and standards compliance. The practice also includes establishing processes to ensure effective data management throughout the enterprise, such as accountability for the adverse effects of poor data quality, and ensuring that the data which an enterprise has can be utilized by the entire organization.",
      },
      {
        CategoryID: "bfff66ff-81c4-415f-93de-1269dd33eccd",
        Category: "Data Modeling Tools",
        CategoryDescription:
          "Data modeling tools typically provide functionalities to convert logical models into physical models automatically. This involves specifying physical properties such as data types, constraints, and indexing",
      },
      {
        CategoryID: "3cd7f15b-74ba-4bd9-9192-14959207cdd6",
        Category: "SQL BUILDER Tools",
        CategoryDescription: "",
      },
      {
        CategoryID: "fbbc63ac-a559-4c8f-8d03-d5de92b5c937",
        Category: "Data Platform",
        CategoryDescription: "",
      },
      {
        CategoryID: "a650958f-01ad-46a5-bd7c-acd4ab954cfe",
        Category: "Business Intelligence / Reporting Tools",
        CategoryDescription: "",
      },
      {
        CategoryID: "71c66965-7a6d-4cae-9d82-73fd4efd3a91",
        Category: "Data Privacy & Security",
        CategoryDescription: "",
      },
      {
        CategoryID: "136dc952-b7f1-473a-809b-47cd4f5623e9",
        Category: "Data Generation Tools",
        CategoryDescription: "",
      },
      {
        CategoryID: "5b7a3bc6-9098-440c-81a6-fe5158c28afb",
        Category: "ETL/ELT Tools ",
        CategoryDescription: "",
      },
    ];
    const updatedCategories = categories.map((category) => ({
      id: uuidv4(),
      name: category.Category,
      description: category.CategoryDescription,
      CreatedAt: getTimestamp(),
      UpdatedAt: getTimestamp(),
      status: DB_TOOL_STATUS.ACTIVE,
    }));

    // Validate input
    if (!Array.isArray(categories) || categories.length === 0) {
      return sendResponse(400, "Invalid input: Provide a list of categories.");
    }
    const tableName = TABLE_NAME.DB_TOOL_CATEGORIES;
    // Use the provided batchWriteItems function
    await batchWriteItems(tableName, updatedCategories);

    return sendResponse(
      200,
      "Categories added successfully.",
      updatedCategories
    );
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
