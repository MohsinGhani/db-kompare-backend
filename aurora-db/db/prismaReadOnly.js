// prismaReadOnly.js
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prismaReadOnly = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_READONLY,
    },
  },
});

export default prismaReadOnly;
