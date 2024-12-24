// import { getItemByQuery } from "../../helpers/dynamodb.js";
// import { TABLE_NAME } from "../../helpers/constants.js";
// import { sendResponse } from "../../helpers/helpers.js";

// export const handler = async (event) => {
//   try {
//     const { userId } = event.queryStringParameters || {};

//     // Validate input
//     if (!userId) {
//       return sendResponse(400, "userId is required.");
//     }

//     // Query parameters
//     const KeyConditionExpression = "userId = :userId";
//     const ExpressionAttributeValues = {
//       ":userId": userId,
//     };

//     const queryParams = {
//       table: TABLE_NAME.SAVED_BLOGS,
//       KeyConditionExpression,
//       ExpressionAttributeValues,
//     };

//     // Fetch data using the helper function
//     const result = await getItemByQuery(queryParams);

//     const allSavedBlogs = await Promise.all(
//         result.map(async (blog) => {
//           const user = await getUserById(blog.createdBy);
//           return { ...blog, createdBy: user };
//         })
//       );

//     return sendResponse(200, "Saved blogs retrieved successfully.", {
//       items: result.Items,
//     });
//   } catch (error) {
//     console.error("Error fetching saved blogs:", error);
//     return sendResponse(500, "Internal Server Error", error.message);
//   }
// };

// // Get blog
// const getBlogById = async (blogId) => {
//   const key = {
//     id: blogId,
//   };
//   try {
//     const result = await getItem(TABLE_NAME.BLOGS, key);
//     if (result.Item) {
//       return result.Item;
//     }

//     console.log("🚀 ~ result.Item:", result.Item);

//     return {};
//   } catch (error) {
//     console.error(`Error fetching blog for ID ${blogId}:`, error);
//     throw error;
//   }
// };
