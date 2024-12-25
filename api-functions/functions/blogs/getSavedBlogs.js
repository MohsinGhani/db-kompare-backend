import { getItem, getItemByQuery } from "../../helpers/dynamodb.js";
import { TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { userId } = event.queryStringParameters || {};

    // Validate input
    if (!userId) {
      return sendResponse(400, "userId is required.");
    }

    // Query parameters for fetching saved blogs
    const queryParams = {
      table: TABLE_NAME.SAVED_BLOGS,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };

    // Fetch saved blogs using the helper function
    const result = await getItemByQuery(queryParams);

    if (!result.Items || result.Items.length === 0) {
      return sendResponse(404, "No saved blogs found for the user.");
    }

    // Enrich blogs with blog data (including `createdBy`) and user data
    const enrichedBlogs = await Promise.all(
      result.Items.map(async (savedBlog) => {
        const enrichedBlog = { ...savedBlog };
        try {
          // Fetch blog data (including `createdBy`)
          const blogData = await getBlogById(savedBlog.blogId);
          if (blogData) {
            Object.assign(enrichedBlog, blogData);
          }

          // Fetch user data for `createdBy`
          if (blogData?.createdBy) {
            const blogCreator = await getUserById(blogData.createdBy);
            enrichedBlog.createdBy = blogCreator;
          }
        } catch (error) {
          console.error(
            `Error enriching blog data for blogId ${savedBlog.blogId}:`,
            error
          );
          enrichedBlog.error = "Failed to enrich blog data.";
        }

        return enrichedBlog;
      })
    );

    // Return the enriched list of blogs
    return sendResponse(200, "Saved blogs retrieved successfully.", {
      items: enrichedBlogs,
    });
  } catch (error) {
    console.error("Error fetching saved blogs:", error);
    return sendResponse(500, "Internal Server Error", { error: error.message });
  }
};

// Helper to fetch a blog by ID
const getBlogById = async (blogId) => {
  try {
    const result = await getItem(TABLE_NAME.BLOGS, { id: blogId });
    if (result && result.Item) {
      return result.Item;
    }
    console.log(`No blog found with ID: ${blogId}`);
    return null;
  } catch (error) {
    console.error(`Error fetching blog with ID ${blogId}:`, error);
    throw error;
  }
};

// Helper to fetch a user by ID
const getUserById = async (userId) => {
  try {
    const result = await getItem(TABLE_NAME.USERS, { id: userId });
    if (result.Item) {
      return result.Item;
    }
    console.log(`No user found with ID: ${userId}`);
    return { id: userId, name: "ANONYMOUS" }; // Fallback user structure
  } catch (error) {
    console.error(`Error fetching user with ID ${userId}:`, error);
    throw error;
  }
};
