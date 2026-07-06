"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/lib/db";
import { latestAttemptQuestionIds, latestAttempts } from "@/lib/recentAttempts";
import { isUnknownAnswer } from "@/lib/answerSelection";
import { ERROR_LABELS, SUBJECT_LABELS, type ErrorReason, type Subject } from "@/lib/types";

function QuestionList() {
  const params=useSearchParams(); const [subject,setSubject]=useState<Subject|"">(""); const [year,setYear]=useState(""); const [reason,setReason]=useState<ErrorReason|"">(""); const [state,setState]=useState(params.get("filter")??""); const [search,setSearch]=useState("");
  const data=useLiveQuery(async()=>({questions:await db.questions.orderBy("examYear").reverse().toArray(), attempts:await db.attempts.toArray(), analyses:await db.errorAnalyses.toArray(), schedules:await db.reviewSchedules.toArray()}),[]) ?? {questions:[],attempts:[],analyses:[],schedules:[]};
  const rows=useMemo(()=>{const recent=latestAttempts(data.attempts,20);const recentQuestionIds=latestAttemptQuestionIds(recent,20);const filtered=data.questions.filter((q)=>{
    if(subject&&q.subject!==subject)return false; if(year&&q.examYear!==Number(year))return false; if(reason&&!data.analyses.some((a)=>a.questionId===q.id&&(a.primaryReason===reason||a.secondaryReasons.includes(reason))))return false; if(search&&!`${q.questionNo} ${q.topicSummary??""}`.includes(search))return false;
    const attempts=data.attempts.filter((a)=>a.questionId===q.id); const last=attempts.slice().sort((a,b)=>b.attemptedAt.localeCompare(a.attemptedAt))[0];
    if(state==="unanswered"&&attempts.length)return false; if(state==="wrong"&&!attempts.some((a)=>!a.isCorrect))return false;
    if(state==="unknown"&&!attempts.some((a)=>isUnknownAnswer(a.userAnswer)))return false; if(state==="repeat"&&attempts.filter((a)=>!a.isCorrect).length<2)return false;
    if(state==="pending"&&!attempts.some((a)=>!a.isCorrect&&!data.analyses.some((x)=>x.attemptId===a.id)))return false;
    if(state==="due"&&!data.schedules.some((s)=>s.targetType==="question"&&s.targetId===q.id&&s.dueAt<=new Date().toISOString()))return false;
    if(state==="recent20"&&!recentQuestionIds.has(q.id))return false;
    return true;
  });if(state!=="recent20")return filtered;const rank=new Map<string,number>();recent.forEach((attempt,index)=>{if(!rank.has(attempt.questionId))rank.set(attempt.questionId,index)});return filtered.sort((a,b)=>(rank.get(a.id)??99)-(rank.get(b.id)??99))},[data,subject,year,reason,state,search]);
  const years=[...new Set(data.questions.map((q)=>q.examYear))].sort((a,b)=>b-a);
  return <><PageHeader eyebrow="Question bank" title="問題一覧"/>
    <div className="card stack" style={{marginBottom:12}}><label className="field"><span><Search size={14}/> 検索</span><input className="input" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="問番号・論点"/></label>
      <div className="grid-2"><select className="select" value={year} onChange={(e)=>setYear(e.target.value)}><option value="">全年度</option>{years.map((v)=><option value={v} key={v}>{v}年</option>)}</select><select className="select" value={subject} onChange={(e)=>setSubject(e.target.value as Subject|"")}><option value="">全科目</option>{Object.entries(SUBJECT_LABELS).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><select className="select" value={state} onChange={(e)=>setState(e.target.value)}><option value="">全状態</option><option value="recent20">直近20問</option><option value="unanswered">未解答</option><option value="wrong">誤答あり</option><option value="unknown">わからない</option><option value="due">復習期限</option><option value="repeat">2回以上誤答</option><option value="pending">分類未完了</option></select><select className="select" value={reason} onChange={(e)=>setReason(e.target.value as ErrorReason|"")}><option value="">全A〜F分類</option>{Object.keys(ERROR_LABELS).map((v)=><option value={v} key={v}>{v}</option>)}</select></div></div>
    <div className="card"><div className="muted tiny">{rows.length}問</div>{rows.map((q)=>{const attempts=data.attempts.filter((a)=>a.questionId===q.id);const last=attempts.slice().sort((a,b)=>b.attemptedAt.localeCompare(a.attemptedAt))[0];return <Link className="list-row" href={`/practice?id=${q.id}`} key={q.id}><div><b>{q.examYear}年・問{q.questionNo}</b><div className="muted tiny">{SUBJECT_LABELS[q.subject]} {last?`・${isUnknownAnswer(last.userAnswer)?"わからない":last.isCorrect?"正解":"不正解"}`:"・未解答"}</div></div><ChevronRight size={19}/></Link>})}{!rows.length&&<p className="muted">条件に合う問題がありません。</p>}</div>
  </>;
}
export default function QuestionsPage(){return <Suspense><QuestionList/></Suspense>}
