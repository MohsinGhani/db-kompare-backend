-- CreateTable
CREATE TABLE "pages" (
    "page_id" SERIAL NOT NULL,
    "page_name" TEXT NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("page_id")
);

-- CreateTable
CREATE TABLE "page_likes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "page_id" INTEGER NOT NULL,
    "liked_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_likes_pkey" PRIMARY KEY ("id")
);
