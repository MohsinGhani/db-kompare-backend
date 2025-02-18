// prismaReadOnly.js
import { PrismaClient } from "@prisma/client";

const prismaReadOnly = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_READONLY,
    },
  },
});

export default prismaReadOnly;
