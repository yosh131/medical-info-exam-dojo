import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
const empty={schemaVersion:1,exportedAt:"2026-06-21T00:00:00.000Z",app:"medical-info-exam-dojo",data:{questions:[],choices:[],attempts:[],errorAnalyses:[],cards:[],reviewSchedules:[],reviewLogs:[],settings:[]}};
describe("backup validation",()=>{
  it("accepts a versioned empty backup",()=>expect(parseBackup(JSON.stringify(empty)).schemaVersion).toBe(1));
  it("rejects unsupported versions",()=>expect(()=>parseBackup(JSON.stringify({...empty,schemaVersion:2}))).toThrow());
  it("rejects malformed rows before restore",()=>expect(()=>parseBackup(JSON.stringify({...empty,data:{...empty.data,questions:[{id:"broken"}]}}))).toThrow());
});
