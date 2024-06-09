import * as React from "react";
import {
  act,
  render,
  screen,
  waitFor,
  TestRenderer,
} from "@testing-library/react-native";
import * as z from "zod";
import {
  levels,
  categories,
  questions,
  questionSets,
  answers,
} from "../../db/schema";
import SeedProvider from "../SeedProvider";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import migrations from "../../drizzle/migrations";
import { db } from "@/services/db";
import { count, eq, sql } from "drizzle-orm";
import { Text } from "react-native";

jest.useFakeTimers();
jest.mock("@/services/db");
jest.mock("@react-native-async-storage/async-storage");

describe("SeedProvider", () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: "./drizzle/" });
  });

  it("should render children after seed", async () => {
    render(
      <SeedProvider>
        <Text>Hi</Text>
      </SeedProvider>
    );

    expect(screen.queryByText("Hi")).toBeFalsy();

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(screen.getByText("Hi")).toBeTruthy();
  });

  it("should seed on empty db", async () => {
    expect((await db.select({ num: count() }).from(questions))[0].num).toBe(0);

    render(<SeedProvider />);

    await act(async () => {
      await jest.runAllTimers();
    });

    await waitFor(async () => {
      expect(
        (await db.select({ num: count() }).from(questions))[0].num
      ).toBeGreaterThan(0);
    });
  });

  it("should seed missing question set", async () => {
    await db
      .insert(questionSets)
      .values({ id: 1, name: "Missing Set" })
      .execute();
    await db
      .insert(questions)
      .values({
        question: "What is the capital of France?",
        answers: ["Paris", "London", "Berlin", "Madrid"],
        correctAnswer: 0,
        level: "easy",
        category: "geography",
        questionSet: 1,
      })
      .execute();

    render(<SeedProvider />);

    await act(async () => {
      await jest.runAllTimers();
    });

    await waitFor(async () => {
      expect(
        (
          await db
            .select({ num: count() })
            .from(questions)
            .where(eq(questions.questionSet, 1))
        )[0].num
      ).toBe(1);

      expect(
        (await db.select({ num: count() }).from(questions))[0].num
      ).toBeGreaterThan(1);
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // delete all tables
    await db.delete(questions).execute();
    await db.delete(questionSets).execute();
    await db.delete(answers).execute();
  });
});

describe("seed.json", () => {
  it("should be valid", () => {
    const seedFile = require("../../constants/seed.json");

    const questionSchema = z.array(
      z.object({
        id: z.number(),
        question: z.string(),
        answers: z.array(z.string()),
        correctAnswer: z.number(),
        level: z.union(levels.map(z.literal)),
        category: z.union(categories.map(z.literal)),
        questionSet: z.number(),
      })
    );
    questionSchema.parse(seedFile.questions);
  });
});
