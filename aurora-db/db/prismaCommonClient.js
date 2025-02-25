import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prismaCommonClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_COMMON,
    },
  },
});

export default prismaCommonClient;
