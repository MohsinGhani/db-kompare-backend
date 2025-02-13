-- CreateEnum
CREATE TYPE "LessonCategory" AS ENUM ('BASIC', 'INTERMEDIATE', 'HARD');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('PGSQL', 'MYSQL', 'ORACLE', 'MSSQL', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportedRuntime" AS ENUM ('POSTGRES', 'MYSQL');

-- CreateEnum
CREATE TYPE "QuestionTag" AS ENUM ('SQL', 'INTERVIEW', 'ALGORITHMS', 'DATA_STRUCTURES', 'MACHINE_LEARNING', 'SYSTEM_DESIGN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('ALL', 'EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('INTERVIEW', 'LESSON');

-- CreateTable
CREATE TABLE "lessons" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "short_title" VARCHAR(100),
    "short_description" VARCHAR(255),
    "description" TEXT,
    "category" "LessonCategory" NOT NULL,
    "type" "LessonType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(255),

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "category" "LessonType" NOT NULL,
    "lesson_id" INTEGER,
    "difficulty" "Difficulty" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "short_title" VARCHAR(100),
    "description" TEXT,
    "supported_runtime" "SupportedRuntime" NOT NULL,
    "solution_explanation" TEXT,
    "base_query" TEXT,
    "seo_description" TEXT,
    "company_id" INTEGER,
    "tag" "QuestionTag"[] DEFAULT ARRAY[]::"QuestionTag"[],
    "question_type" "QuestionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lessons_slug_key" ON "lessons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_name_key" ON "company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "company_slug_key" ON "company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "questions_slug_key" ON "questions"("slug");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
