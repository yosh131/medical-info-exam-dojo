import { readFileSync } from "node:fs";
import { importQuestionSchema } from "../lib/importer";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: npm run validate:questions -- <questions.json>");
const value: unknown = JSON.parse(readFileSync(filename, "utf8"));
if (!Array.isArray(value)) throw new Error("Top-level JSON value must be an array");

const keys = new Set<string>();
const errors: string[] = [];
for (const [index, row] of value.entries()) {
  const parsed = importQuestionSchema.safeParse(row);
  if (!parsed.success) {
    errors.push(`#${index + 1}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" / ")}`);
    continue;
  }
  const key = `${parsed.data.examYear}|${parsed.data.subject}|${parsed.data.questionNo}`;
  if (keys.has(key)) errors.push(`#${index + 1}: duplicate key ${key}`);
  keys.add(key);
}
if (errors.length) throw new Error(`Validation failed (${errors.length} rows)\n${errors.slice(0, 20).join("\n")}`);
console.log(`Valid: ${value.length} questions (${keys.size} unique keys)`);
