import AWS from "aws-sdk";
import axios from "axios";
import XLSX from "xlsx";

const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = "DatabaseRankings"; // Replace with your table name

export const handler = async (event) => {
  try {
    // Get the Excel file link from the event
    const { excelFileUrl } = JSON.parse(event.body);

    if (!excelFileUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Excel file URL is required" }),
      };
    }

    // Download the Excel file
    const response = await axios.get(excelFileUrl, {
      responseType: "arraybuffer",
    });
    const workbook = XLSX.read(response.data, { type: "buffer" });

    // Parse the first sheet of the workbook
    const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
    const sheet = workbook.Sheets[sheetName];

    // Extract raw rows (including headers) using `header: 1`
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Separate headers and rows
    const headers = rawData[0]; // First row contains headers
    const rows = rawData.slice(1); // Remaining rows contain data

    // Map rows to objects using headers and filter out empty rows
    const mappedData = rows
      .map((row) => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = row[index] || ""; // Map each header to its corresponding cell value
        });
        return record;
      })
      .filter((record) => {
        // Remove rows where all values are empty
        return Object.values(record).some((value) => value !== "");
      });

    console.log("data", mappedData);

    // Insert data into DynamoDB (if required, replace this block with actual insertion logic)
    // for (const item of mappedData) {
    //   const params = {
    //     TableName: TABLE_NAME,
    //     Item: item,
    //   };
    //   await dynamodb.put(params).promise();
    // }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Data inserted successfully!",
        recordsProcessed: mappedData.length,
      }),
    };
  } catch (error) {
    console.error("Error processing Excel file:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to process data",
        error: error.message,
      }),
    };
  }
};
