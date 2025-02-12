import { runQuery } from "../../helpers/db-client.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
    try {
      // Simple SELECT query to retrieve all assignments
      const assignments = await runQuery('SELECT * FROM assignments');
  
      // Return the results using your standardized response function
      return sendResponse(200, "Successfully retrieved assignments", assignments);
    } catch (error) {
      console.error('Lambda Error:', error);
      return sendResponse(500, error.message, null);
    }
  };
  