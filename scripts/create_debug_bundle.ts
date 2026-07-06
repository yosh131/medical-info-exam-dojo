import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { referencedMediaPaths, selectDebugQuestions } from "../lib/debugBundle";

const output = resolve("public/__debug__/questions.zip");
if (process.argv.includes("--clean")) {
  rmSync(resolve("public/__debug__"), { recursive: true, force: true });
  console.log("Removed local debug data.");
  process.exit(0);
}

const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const countArg = process.argv.find((arg) => arg.startsWith("--count="));
const source = resolve(sourceArg?.slice("--source=".length) ?? "imports/question_bundles/latest_5_years.zip");
const count = Number(countArg?.slice("--count=".length) ?? 12);
const files = unzipSync(new Uint8Array(readFileSync(source)));
if (!files["manifest.json"] || !files["questions.json"]) throw new Error("Source is not a question bundle");

const questions = JSON.parse(strFromU8(files["questions.json"])) as Array<{ media?: Array<{ path: string }> }>;
const selected = selectDebugQuestions(questions, count);
const mediaPaths = referencedMediaPaths(selected);
const sourceManifest = JSON.parse(strFromU8(files["manifest.json"])) as Record<string, unknown>;
const manifest = { ...sourceManifest, createdAt: new Date().toISOString(), questionCount: selected.length, mediaCount: mediaPaths.length };
const outputFiles: Record<string, Uint8Array> = {
  "manifest.json": strToU8(JSON.stringify(manifest, null, 2) + "\n"),
  "questions.json": strToU8(JSON.stringify(selected))
};
for (const path of mediaPaths) {
  if (!files[path]) throw new Error(`Missing source media: ${path}`);
  outputFiles[path] = files[path];
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, zipSync(outputFiles, { level: 6 }));
console.log(`Created ${output}: ${selected.length} questions, ${mediaPaths.length} media files.`);
