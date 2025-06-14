export const TABLE_NAME = {
  DATABASES: process.env.DATABASES_TABLE,
  METRICES: process.env.METRICES_TABLE,
  DATABASE_RANKINGS: process.env.RANKING_TABLE,
  USERS: process.env.USERS_TABLE,
  COMMENTS: process.env.COMMENTS_TABLE,
  BLOGS: process.env.BLOGS_TABLE,
  SAVED_BLOGS: process.env.SAVED_BLOGS_TABLE,
  TRACKING_RESOURCES: process.env.TRACKING_RESOURCES_TABLE,
  DB_TOOL_CATEGORIES: process.env.DB_TOOL_CATEGORIES_TABLE,
  DB_TOOLS: process.env.DB_TOOLS_TABLE,
  DB_TOOLS_METRICES: process.env.DB_TOOLS_METRICES_TABLE,
  DB_TOOLS_RANKINGS: process.env.DB_TOOLS_RANKINGS_TABLE,
  QUESTIONS: process.env.QUESTIONS_TABLE,
  COMPANIES: process.env.COMPANIES_TABLE,
  TAGS: process.env.TAGS_TABLE,
  DATABASE_AGGREGATED: process.env.DATABASE_AGGREGATED_TABLE,
  DB_TOOLS_AGGREGATED: process.env.DB_TOOLS_AGGREGATED_TABLE,
  SUBMISSIONS: process.env.SUBMISSIONS_TABLE,
  PROFILING: process.env.PROFILING_TABLE,
  FIDDLES: process.env.FIDDLES_TABLE,
  QUIZZES: process.env.QUIZZES_TABLE,
  QUIZZES_QUESTIONS: process.env.QUIZZES_QUESTIONS_TABLE,
  QUIZZES_SUBMISSIONS: process.env.QUIZZES_SUBMISSIONS_TABLE,
  CERTIFICATES: process.env.CERTIFICATES_TABLE,
  CATEGORIES: process.env.CATEGORIES_TABLE,
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
export const DB_TOOL_STATUS = {
  ALL: "ALL",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};
export const QUERY_STATUS = {
  ALL: "ALL",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};
export const METRICES_TYPE = {
  DAY: "DAY",
  WEEK: "WEEK",
  MONTH: "MONTH",
  YEAR: "YEAR",
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

export const LESSON_CATEGORY = {
  BASIC: "BASIC",
  INTERMEDIATE: "INTERMEDIATE",
  HARD: "HARD",
};

export const TOPICS_CATEGORIES = {
  SQL: "SQL",
  PGSQL: "PGSQL",
  MYSQL: "MYSQL",
  ORACLE: "ORACLE",
  MSSQL: "MSSQL",
  OTHER: "OTHER",
};

export const QUIZ_SUBMISSION_STATUS = {
  PASSED: "PASSED",
  FAILED: "FAILED",
};

export const SUPPORTED_RUNTIME = {
  POSTGRES: "POSTGRES",
  MYSQL: "MYSQL",
};

export const DIFFICULTY = {
  ALL: "ALL",
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
};

export const QUESTION_TYPE = {
  INTERVIEW: "INTERVIEW",
  LESSON: "LESSON",
};
