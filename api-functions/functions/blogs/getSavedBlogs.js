import { getItem, getItemByQuery } from "../../helpers/dynamodb.js";
import { TABLE_NAME, BLOG_TYPE } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    const { userId, type } = event.queryStringParameters || {};

    // Validate input
    if (!userId) {
      return sendResponse(400, "userId is required.");
    }

    if (!type || ![BLOG_TYPE.BLOG, BLOG_TYPE.SAVED_BLOG].includes(type)) {
      return sendResponse(
        400,
        "Invalid type provided. Must be BLOG or SAVED_BLOG."
      );
    }

    let queryParams;
    if (type === BLOG_TYPE.BLOG) {
      // Query parameters for fetching blogs created by the user
      queryParams = {
        table: TABLE_NAME.BLOGS,
        IndexName: "byStatus", // Use GSI for efficient querying
        KeyConditionExpression: "#status = :status",
        FilterExpression: "createdBy = :userId",
        ExpressionAttributeNames: {
          "#status": "status", // Map reserved keyword to a placeholder
        },
        ExpressionAttributeValues: {
          ":status": "PUBLIC", // Assuming you want only published blogs
          ":userId": userId,
        },
      };
    } else if (type === BLOG_TYPE.SAVED_BLOG) {
      // Query parameters for fetching saved blogs
      queryParams = {
        table: TABLE_NAME.SAVED_BLOGS,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      };
    }

    // Fetch blogs based on the type
    const result = await getItemByQuery(queryParams);

    if (!result.Items || result.Items.length === 0) {
      const message =
        type === BLOG_TYPE.BLOG
          ? "No blogs found for the user."
          : "No saved blogs found for the user.";
      return sendResponse(404, message);
    }

    // Enrich blogs with additional data
    const enrichedBlogs = await Promise.all(
      result.Items.map(async (blog) => {
        const enrichedBlog = { ...blog };

        try {
          if (type === BLOG_TYPE.BLOG) {
            // Fetch user data for `createdBy`
            const blogCreator = await getUserById(blog.createdBy);
            if (blogCreator) {
              enrichedBlog.createdBy = blogCreator;
            }
          } else if (type === BLOG_TYPE.SAVED_BLOG) {
            // Fetch blog data for saved blogs
            const blogData = await getBlogById(blog.blogId);
            if (blogData) {
              Object.assign(enrichedBlog, blogData);

              // Fetch user data for `createdBy`
              if (blogData.createdBy) {
                const blogCreator = await getUserById(blogData.createdBy);
                enrichedBlog.createdBy = blogCreator;
              }
            }
          }
        } catch (error) {
          console.error(
            `Error enriching blog data for ${
              type === BLOG_TYPE.BLOG ? "blogId" : "savedBlogId"
            } ${type === BLOG_TYPE.BLOG ? blog.id : blog.blogId}:`,
            error
          );
          enrichedBlog.error = "Failed to enrich blog data.";
        }

        return enrichedBlog;
      })
    );

    // Return the enriched list of blogs
    return sendResponse(
      200,
      `${
        type === BLOG_TYPE.BLOG ? "User blogs" : "Saved blogs"
      } retrieved successfully.`,
      {
        items: enrichedBlogs,
      }
    );
  } catch (error) {
    console.error("Error fetching blogs:", error);
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
