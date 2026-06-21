import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { bundleManifestSchema, importQuestionSchema } from "../lib/importer";

const filename=process.argv[2];if(!filename)throw new Error("Usage: npm run validate:bundle -- <questions.zip>");
const files=unzipSync(new Uint8Array(readFileSync(filename)));if(!files["manifest.json"]||!files["questions.json"])throw new Error("Required files are missing");
const manifest=bundleManifestSchema.parse(JSON.parse(strFromU8(files["manifest.json"])));const questions:unknown=JSON.parse(strFromU8(files["questions.json"]));
if(!Array.isArray(questions)||questions.length!==manifest.questionCount)throw new Error("Question count mismatch");
const keys=new Set<string>(),mediaIds=new Set<string>();let mediaCount=0;
for(const [index,row] of questions.entries()){
  const parsed=importQuestionSchema.safeParse(row);if(!parsed.success)throw new Error(`#${index+1}: ${parsed.error.message}`);
  const key=`${parsed.data.examYear}|${parsed.data.subject}|${parsed.data.questionNo}`;if(keys.has(key))throw new Error(`Duplicate question key: ${key}`);keys.add(key);
  for(const media of parsed.data.media){if(mediaIds.has(media.id))throw new Error(`Duplicate media id: ${media.id}`);mediaIds.add(media.id);const bytes=files[media.path];if(!bytes)throw new Error(`Missing media: ${media.path}`);const hash=createHash("sha256").update(bytes).digest("hex");if(hash!==media.sha256)throw new Error(`Media hash mismatch: ${media.path}`);mediaCount++}
}
if(mediaCount!==manifest.mediaCount)throw new Error("Media count mismatch");console.log(`Valid bundle: ${questions.length} questions, ${mediaCount} media files, ${keys.size} unique keys`);
