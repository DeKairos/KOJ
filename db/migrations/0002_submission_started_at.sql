-- Custom SQL migration file, put your code below! --
ALTER TABLE "submissions" ADD COLUMN "started_at" timestamp with time zone;
