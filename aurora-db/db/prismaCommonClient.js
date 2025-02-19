import { PrismaClient } from "@prisma/client";

const prismaCommonClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_COMMON,
    },
  },
});

export default prismaCommonClient;
