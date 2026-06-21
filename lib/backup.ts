import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { db, setSetting } from "./db";
import type { BackupEnvelope, BackupMediaRecord } from "./types";

const id = z.string().min(1), iso = z.string().datetime();
const question = z.object({ id, examYear:z.number().int(), subject:z.enum(["information","medical","system"]), questionNo:z.number().int(), body:z.string(), questionType:z.enum(["single_choice","multiple_choice","true_false_combination","other"]), correctAnswer:z.union([z.string(),z.array(z.string())]), explanation:z.string().optional(), bodyTableHtml:z.string().optional(), explanationTableHtml:z.string().optional(), topicSummary:z.string().optional(), source:z.string().optional(), sourceUrl:z.string().optional(), rightsNote:z.string().optional(), contentHash:z.string(), createdAt:iso, updatedAt:iso });
const choice = z.object({ id, questionId:id, label:z.string(), text:z.string(), isCorrect:z.boolean().optional() });
const media = z.object({ id, questionId:id, role:z.enum(["question","explanation"]), order:z.number().int(), fileName:z.string(), mimeType:z.enum(["image/png","image/jpeg","image/webp","image/gif","application/pdf"]), sha256:z.string().regex(/^[a-f0-9]{64}$/i), path:z.string().startsWith("media/"), createdAt:iso });
const attempt = z.object({ id, questionId:id, userAnswer:z.union([z.string(),z.array(z.string())]), isCorrect:z.boolean(), confidence:z.enum(["high","medium","low"]), elapsedSec:z.number().optional(), attemptedAt:iso });
const analysis = z.object({ id, attemptId:id, questionId:id, primaryReason:z.enum(["A","B","C","D","E","F"]), secondaryReasons:z.array(z.enum(["A","B","C","D","E","F"])), readingMistakeType:z.enum(["missed_negative","missed_positive","missed_best_answer","wrong_subject","missed_condition","missed_number_or_unit","other"]).optional(), note:z.string().optional(), createdAt:iso });
const card = z.object({ id, questionId:id.optional(), subject:z.enum(["information","medical","system"]), cardType:z.enum(["term","judgement","comparison","workflow","calculation","reading_mistake"]), front:z.string(), back:z.string(), tags:z.array(z.string()), dueAt:iso, intervalDays:z.number(), reviewCount:z.number(), successCount:z.number(), failureCount:z.number(), isImportant:z.boolean(), sourceReason:z.enum(["A","B","C","D","E","F"]).optional(), examWeekReviewedAt:iso.optional(), createdAt:iso, updatedAt:iso });
const schedule = z.object({ id, targetType:z.enum(["question","card"]), targetId:id, dueAt:iso, successStreak:z.number(), intervalDays:z.number(), updatedAt:iso });
const log = z.object({ id, targetType:z.enum(["question","card"]), targetId:id, result:z.enum(["good","hard","again"]), reviewedAt:iso });
const setting = z.object({ key:z.string(), value:z.unknown(), updatedAt:iso });
export const backupSchema = z.object({ schemaVersion:z.literal(1), exportedAt:iso, app:z.literal("medical-info-exam-dojo"),
  data:z.object({ questions:z.array(question), choices:z.array(choice), media:z.array(media), attempts:z.array(attempt),
    errorAnalyses:z.array(analysis), cards:z.array(card), reviewSchedules:z.array(schedule), reviewLogs:z.array(log), settings:z.array(setting) }).strict()
}).strict();

export interface ParsedBackup { backup: BackupEnvelope; files: Record<string, Uint8Array> }
const safePath = (path:string) => !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..") && !path.includes("\0");
const safeName = (name:string) => name.replace(/[^\p{L}\p{N}._-]+/gu,"_").slice(-120) || "media";
async function digest(bytes:Uint8Array){const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);const value=await crypto.subtle.digest("SHA-256",copy.buffer);return Array.from(new Uint8Array(value),(b)=>b.toString(16).padStart(2,"0")).join("")}

export async function createBackup(): Promise<Uint8Array> {
  const [questions, choices, storedMedia, attempts, errorAnalyses, cards, reviewSchedules, reviewLogs, settings] = await Promise.all([
    db.questions.toArray(), db.choices.toArray(), db.questionMedia.toArray(), db.attempts.toArray(), db.errorAnalyses.toArray(),
    db.cards.toArray(), db.reviewSchedules.toArray(), db.reviewLogs.toArray(), db.settings.toArray()
  ]);
  const files: Record<string, Uint8Array> = {}; const mediaRecords: BackupMediaRecord[] = [];
  for (const item of storedMedia) {
    const path=`media/${item.id}/${safeName(item.fileName)}`; files[path]=new Uint8Array(await item.blob.arrayBuffer());
    const {blob:_,...metadata}=item; mediaRecords.push({...metadata,path});
  }
  const envelope: BackupEnvelope = { schemaVersion:1, exportedAt:new Date().toISOString(), app:"medical-info-exam-dojo",
    data:{questions,choices,media:mediaRecords,attempts,errorAnalyses,cards,reviewSchedules,reviewLogs,settings} };
  files["backup.json"]=strToU8(JSON.stringify(envelope)); return zipSync(files,{level:6});
}

export async function parseBackup(input: ArrayBuffer): Promise<ParsedBackup> {
  let files:Record<string,Uint8Array>; try{files=unzipSync(new Uint8Array(input))}catch{throw new Error("バックアップZIPを展開できません")}
  for(const path of Object.keys(files))if(!safePath(path))throw new Error("バックアップに安全でないパスがあります");
  if(!files["backup.json"])throw new Error("backup.jsonがありません");
  let raw:unknown;try{raw=JSON.parse(strFromU8(files["backup.json"]))}catch{throw new Error("backup.jsonの構文が正しくありません")}
  const parsed=backupSchema.safeParse(raw);if(!parsed.success)throw new Error("対応していない、または破損したバックアップです");
  const backup=parsed.data as BackupEnvelope; const questionIds=new Set(backup.data.questions.map((row)=>row.id));
  const attemptIds=new Set(backup.data.attempts.map((row)=>row.id));const cardIds=new Set(backup.data.cards.map((row)=>row.id));
  if(backup.data.choices.some((row)=>!questionIds.has(row.questionId))||backup.data.media.some((row)=>!questionIds.has(row.questionId))||
    backup.data.attempts.some((row)=>!questionIds.has(row.questionId))||backup.data.errorAnalyses.some((row)=>!questionIds.has(row.questionId)||!attemptIds.has(row.attemptId))||
    backup.data.cards.some((row)=>row.questionId&&!questionIds.has(row.questionId))||backup.data.reviewSchedules.some((row)=>row.targetType==="question"?!questionIds.has(row.targetId):!cardIds.has(row.targetId))||
    backup.data.reviewLogs.some((row)=>row.targetType==="question"?!questionIds.has(row.targetId):!cardIds.has(row.targetId)))throw new Error("バックアップ内のデータ参照が破損しています");
  for(const item of backup.data.media){const bytes=files[item.path];if(!bytes)throw new Error(`メディアがありません: ${item.path}`);if(await digest(bytes)!==item.sha256)throw new Error(`メディアが破損しています: ${item.path}`)}
  return {backup,files};
}

export async function restoreBackup(parsed: ParsedBackup) {
  const {backup,files}=parsed;
  await db.transaction("rw",db.tables,async()=>{
    await Promise.all(db.tables.map((table)=>table.clear()));
    await db.questions.bulkAdd(backup.data.questions);await db.choices.bulkAdd(backup.data.choices);
    if(backup.data.media.length)await db.questionMedia.bulkAdd(backup.data.media.map(({path,...item})=>({...item,blob:new Blob([files[path] as BlobPart],{type:item.mimeType})})));
    await db.attempts.bulkAdd(backup.data.attempts);await db.errorAnalyses.bulkAdd(backup.data.errorAnalyses);await db.cards.bulkAdd(backup.data.cards);
    await db.reviewSchedules.bulkAdd(backup.data.reviewSchedules);await db.reviewLogs.bulkAdd(backup.data.reviewLogs);await db.settings.bulkAdd(backup.data.settings);
  });
}

export function downloadFile(bytes:Uint8Array,filename:string){const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);const url=URL.createObjectURL(new Blob([copy.buffer],{type:"application/zip"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url)}
export async function markBackupComplete(){await setSetting("lastBackupAt",new Date().toISOString())}
