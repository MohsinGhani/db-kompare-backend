export const TABLE_NAME = {
  DATABASES: process.env.DATABASES_TABLE,
  METRICES: process.env.METRICES_TABLE,
  DATABASE_RANKINGS: process.env.RANKING_TABLE,
  USERS: process.env.USERS_TABLE,
  COMMENTS: process.env.COMMENTS_TABLE,
  BLOGS: process.env.BLOGS_TABLE,
  SAVED_BLOGS: process.env.SAVED_BLOGS_TABLE,
};

export const STATUS_CODE = {
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  SUCCESS: 200,
};

export const DATABASE_STATUS = {
  ALL: "ALL",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const USER_ROLE = {
  ADMIN: "ADMIN",
  VENDOR: "VENDOR",
};
export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const BLOG_TYPE = {
  BLOG: "BLOG",
  SAVED_BLOG: "SAVED_BLOG",
};

export const RESOURCE_TYPE = {
  GITHUB: "GITHUB",
  STACKOVERFLOW: "STACKOVERFLOW",
  GOOGLE: "GOOGLE",
  BING: "BING",
  ALL: "ALL",
};
