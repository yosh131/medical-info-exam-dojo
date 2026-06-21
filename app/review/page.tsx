"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/lib/db";
import { inExamWeek, promoteImportantCards, recordReview } from "@/lib/scheduler";
import type { ReviewResult } from "@/lib/types";

export default function ReviewPage(){
  const [showBack,setShowBack]=useState(false); const [notice,setNotice]=useState("");
  const exam=useLiveQuery(()=>db.settings.get("examDate"),[]); useEffect(()=>{promoteImportantCards(typeof exam?.value==="string"?exam.value:undefined).catch(()=>undefined)},[exam?.value]);
  const schedules=useLiveQuery(()=>db.reviewSchedules.where("dueAt").belowOrEqual(new Date().toISOString()).sortBy("dueAt"),[])??[];
  const current=schedules[0]; const card=useLiveQuery(()=>current?.targetType==="card"?db.cards.get(current.targetId):undefined,[current?.id]); const question=useLiveQuery(()=>current?.targetType==="question"?db.questions.get(current.targetId):undefined,[current?.id]);
  async function result(value:ReviewResult){if(!current)return;await recordReview(current.targetType,current.targetId,value);if(current.targetType==="card"&&card&&typeof exam?.value==="string"&&inExamWeek(exam.value))await db.cards.update(card.id,{examWeekReviewedAt:new Date().toISOString()});setShowBack(false);setNotice("次回の復習日を更新しました")}
  return <><PageHeader eyebrow="Review queue" title="今日の復習"/>
    <div className="card" style={{marginBottom:12}}><span className="pill"><Sparkles size={14}/>期限到来</span><div className="metric" style={{marginTop:8}}>{schedules.length} 件</div></div>
    {!current&&<div className="card" style={{textAlign:"center",padding:"38px 20px"}}><Check size={38} color="#0b6b58"/><h2 style={{marginTop:12}}>今日の復習は完了です</h2><p className="muted">少し休んで、また一問。</p></div>}
    {current&&card&&<section className="card stack"><div className="pill" style={{width:"fit-content"}}>カード</div><div style={{minHeight:150,display:"grid",placeItems:"center",textAlign:"center",fontSize:"1.25rem",fontWeight:750,whiteSpace:"pre-wrap"}}>{showBack?card.back:card.front}</div>{!showBack?<button className="button" onClick={()=>setShowBack(true)}>答えを見る</button>:<ReviewButtons onResult={result}/>}</section>}
    {current&&question&&<section className="card stack"><div className="pill" style={{width:"fit-content"}}>問題</div><h2>{question.examYear}年・問{question.questionNo}</h2><p className="muted">問題を解いたあと、手応えを記録してください。</p><Link href={`/practice?id=${question.id}`} className="button"><RotateCcw size={18}/>問題を解く</Link><ReviewButtons onResult={result}/></section>}
    {notice&&<p className="success tiny">{notice}</p>}
  </>;
}
function ReviewButtons({onResult}:{onResult:(result:ReviewResult)=>void}){return <div className="grid-2"><button className="button danger" onClick={()=>onResult("again")}>もう一度</button><button className="button secondary" onClick={()=>onResult("hard")}>難しい</button><button className="button" style={{gridColumn:"1 / -1"}} onClick={()=>onResult("good")}>できた</button></div>}
