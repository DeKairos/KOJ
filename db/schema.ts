import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["contestant", "problem_setter", "admin"]);
export const problemDifficulty = pgEnum("problem_difficulty", ["easy", "medium", "hard"]);
export const problemStatus = pgEnum("problem_status", ["draft", "contest_active", "published"]);
export const contestStatus = pgEnum("contest_status", ["draft", "live", "ended", "archived"]);
export const submissionStatus = pgEnum("submission_status", [
  "pending",
  "running",
  "accepted",
  "wrong_answer",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "runtime_error",
  "compilation_error",
]);

export const users = pgTable("users", {
  clerkId: text("clerk_id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  role: userRole("role").notNull().default("contestant"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const problems = pgTable("problems", {
  id: serial("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.clerkId),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  inputFormat: text("input_format").notNull(),
  outputFormat: text("output_format").notNull(),
  constraints: text("constraints").notNull(),
  explanation: text("explanation"),
  difficulty: problemDifficulty("difficulty").notNull().default("easy"),
  tags: text("tags").array().notNull().default([]),
  timeLimitMs: integer("time_limit_ms").notNull().default(1000),
  memoryLimitMb: integer("memory_limit_mb").notNull().default(256),
  status: problemStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const problemTestCases = pgTable("problem_test_cases", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id")
    .notNull()
    .references(() => problems.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isSample: boolean("is_sample").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const contests = pgTable("contests", {
  id: serial("id").primaryKey(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.clerkId),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: contestStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contestProblems = pgTable(
  "contest_problems",
  {
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    problemId: integer("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.contestId, table.problemId] })],
);

export const contestRegistrations = pgTable(
  "contest_registrations",
  {
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkId, { onDelete: "cascade" }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.contestId, table.userId] })],
);

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.clerkId),
  problemId: integer("problem_id")
    .notNull()
    .references(() => problems.id),
  contestId: integer("contest_id").references(() => contests.id),
  language: text("language").notNull(),
  code: text("code").notNull(),
  status: submissionStatus("status").notNull().default("pending"),
  executionTimeMs: integer("execution_time_ms"),
  memoryUsedMb: integer("memory_used_mb"),
  passedTests: integer("passed_tests"),
  totalTests: integer("total_tests"),
  errorMessage: text("error_message"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const usersRelations = relations(users, ({ many }) => ({
  authoredProblems: many(problems),
  createdContests: many(contests),
  registrations: many(contestRegistrations),
  submissions: many(submissions),
}));

export const problemsRelations = relations(problems, ({ one, many }) => ({
  author: one(users, { fields: [problems.authorId], references: [users.clerkId] }),
  testCases: many(problemTestCases),
  contests: many(contestProblems),
  submissions: many(submissions),
}));

export const contestsRelations = relations(contests, ({ one, many }) => ({
  creator: one(users, { fields: [contests.createdBy], references: [users.clerkId] }),
  problems: many(contestProblems),
  registrations: many(contestRegistrations),
  submissions: many(submissions),
}));

export const problemTestCasesRelations = relations(problemTestCases, ({ one }) => ({
  problem: one(problems, { fields: [problemTestCases.problemId], references: [problems.id] }),
}));

export const contestProblemsRelations = relations(contestProblems, ({ one }) => ({
  contest: one(contests, { fields: [contestProblems.contestId], references: [contests.id] }),
  problem: one(problems, { fields: [contestProblems.problemId], references: [problems.id] }),
}));

export const contestRegistrationsRelations = relations(contestRegistrations, ({ one }) => ({
  contest: one(contests, { fields: [contestRegistrations.contestId], references: [contests.id] }),
  user: one(users, { fields: [contestRegistrations.userId], references: [users.clerkId] }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  user: one(users, { fields: [submissions.userId], references: [users.clerkId] }),
  problem: one(problems, { fields: [submissions.problemId], references: [problems.id] }),
  contest: one(contests, { fields: [submissions.contestId], references: [contests.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Problem = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;
export type Contest = typeof contests.$inferSelect;
export type NewContest = typeof contests.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
