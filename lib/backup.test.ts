import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { parseBackup } from "./backup";
const empty={schemaVersion:1,exportedAt:"2026-06-21T00:00:00.000Z",app:"medical-info-exam-dojo",data:{questions:[],choices:[],media:[],attempts:[],errorAnalyses:[],cards:[],reviewSchedules:[],reviewLogs:[],settings:[]}};
const archive=(value:unknown)=>{const bytes=zipSync({"backup.json":strToU8(JSON.stringify(value))});return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer};
describe("backup validation",()=>{
  it("accepts a versioned empty backup",async()=>expect((await parseBackup(archive(empty))).backup.schemaVersion).toBe(1));
  it("rejects unsupported versions",async()=>await expect(parseBackup(archive({...empty,schemaVersion:2}))).rejects.toThrow());
  it("rejects malformed rows before restore",async()=>await expect(parseBackup(archive({...empty,data:{...empty.data,questions:[{id:"broken"}]}}))).rejects.toThrow());
});
