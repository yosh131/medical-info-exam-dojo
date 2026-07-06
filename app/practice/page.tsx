"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Brain, ChevronLeft, ChevronRight, Clipboard, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { QuestionMediaList } from "@/components/QuestionMedia";
import { SafeTable } from "@/components/SafeTable";
import { db, isoNow, makeId } from "@/lib/db";
import { isCorrectAnswer } from "@/lib/importer";
import { ensureSchedule } from "@/lib/scheduler";
import { createConsultationTemplate } from "@/lib/chatgpt";
import { adjacentQuestion, sortPracticeQuestions } from "@/lib/practiceNavigation";
import { CARD_TYPE_LABELS, CONFIDENCE_LABELS, ERROR_LABELS, SUBJECT_LABELS, type CardType, type Confidence, type ErrorReason, type ReadingMistakeType } from "@/lib/types";

const readingOptions: [ReadingMistakeType,string][] = [["missed_negative","誤っているものを読み落とした"],["missed_positive","正しいものを読み落とした"],["missed_best_answer","最も適切を見落とした"],["wrong_subject","主体を取り違えた"],["missed_condition","時点・条件を見落とした"],["missed_number_or_unit","数値・単位を読み落とした"],["other","その他"]];

function QuestionNavigation({hasPrevious,hasNext,onMove,position}:{hasPrevious:boolean;hasNext:boolean;onMove:(direction:-1|1)=>void;position:"top"|"bottom"}){
  return <nav className={`question-nav ${position}`} aria-label={`${position==="top"?"上部":"下部"}の問題移動`}><button className="button ghost" disabled={!hasPrevious} onClick={()=>onMove(-1)}><ChevronLeft size={18}/>前の問題</button><button className="button" disabled={!hasNext} onClick={()=>onMove(1)}>次の問題<ChevronRight size={18}/></button></nav>;
}

function Practice() {
  const params=useSearchParams(), router=useRouter(); const requested=params.get("id");
  const all=useLiveQuery(async()=>sortPracticeQuestions(await db.questions.toArray()),[])??[];
  const question=useLiveQuery(async()=>{if(requested)return db.questions.get(requested);const questions=sortPracticeQuestions(await db.questions.toArray());const attempts=await db.attempts.toArray();const answered=new Set(attempts.map((a)=>a.questionId));return questions.find((q)=>!answered.has(q.id))??questions[0]},[requested]);
  const choices=useLiveQuery(()=>question?db.choices.where("questionId").equals(question.id).sortBy("label"):[],[question?.id])??[];
  const media=useLiveQuery(()=>question?db.questionMedia.where("questionId").equals(question.id).sortBy("order"):[],[question?.id])??[];
  const [answers,setAnswers]=useState<string[]>([]); const [confidence,setConfidence]=useState<Confidence>("medium"); const [attemptId,setAttemptId]=useState<string>(); const [correct,setCorrect]=useState<boolean>(); const started=useRef(Date.now());
  const [primary,setPrimary]=useState<ErrorReason>(); const [secondary,setSecondary]=useState<ErrorReason[]>([]); const [reading,setReading]=useState<ReadingMistakeType>(); const [note,setNote]=useState(""); const [analysisSaved,setAnalysisSaved]=useState(false); const [cardOpen,setCardOpen]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{setAnswers([]);setConfidence("medium");setAttemptId(undefined);setCorrect(undefined);setPrimary(undefined);setSecondary([]);setReading(undefined);setNote("");setAnalysisSaved(false);setCardOpen(false);setMessage("");started.current=Date.now()},[question?.id]);
  const multiple=question?Array.isArray(question.correctAnswer)||question.questionType==="multiple_choice":false;
  async function toggle(label:string){if(correct!==undefined)return;if(multiple){setAnswers((old)=>old.includes(label)?old.filter((x)=>x!==label):[...old,label]);return}const selected=[label];setAnswers(selected);await grade(selected)}
  async function grade(selected=answers){if(!question||!selected.length)return;const isCorrect=isCorrectAnswer(selected,question.correctAnswer);const id=makeId();await db.attempts.add({id,questionId:question.id,userAnswer:multiple?selected:selected[0],isCorrect,confidence,elapsedSec:Math.round((Date.now()-started.current)/1000),attemptedAt:isoNow()});setAttemptId(id);setCorrect(isCorrect);if(!isCorrect||confidence==="low")await ensureSchedule("question",question.id,1)}
  async function saveAnalysis(){if(!question||!attemptId||!primary)return;await db.errorAnalyses.add({id:makeId(),attemptId,questionId:question.id,primaryReason:primary,secondaryReasons:secondary.filter((x)=>x!==primary),readingMistakeType:primary==="F"?reading:undefined,note:note.trim()||undefined,createdAt:isoNow()});setAnalysisSaved(true);setMessage("分類を保存しました")}
  async function copyTemplate(){if(!question)return;if(!window.confirm("問題文・選択肢を含むテンプレートをクリップボードへコピーします。外部サービスへの送信はご自身で判断してください。"))return;await navigator.clipboard.writeText(createConsultationTemplate(question,choices,multiple?answers:answers[0]));setMessage("相談テンプレートをコピーしました")}
  function move(direction:-1|1){if(!question)return;const target=adjacentQuestion(all,question.id,direction);if(target)router.push(`/practice?id=${target.id}`)}
  if(!question)return <><PageHeader eyebrow="Practice" title="問題演習"/><div className="card"><p>問題がまだありません。</p><a className="button" href="../import">インポートへ</a></div></>;
  const needsAnalysis=correct===false||(correct===true&&confidence!=="high");
  const currentIndex=all.findIndex((item)=>item.id===question.id); const hasPrevious=currentIndex>0; const hasNext=currentIndex>=0&&currentIndex<all.length-1;
  const correctLabels=new Set(Array.isArray(question.correctAnswer)?question.correctAnswer:[question.correctAnswer]);
  return <><PageHeader eyebrow={`${question.examYear} / ${SUBJECT_LABELS[question.subject]} · ${currentIndex+1} / ${all.length}`} title={`問 ${question.questionNo}`}/>
    <QuestionNavigation hasPrevious={hasPrevious} hasNext={hasNext} onMove={move} position="top"/>
    <article className="question-body">{question.body}</article>
    <SafeTable html={question.bodyTableHtml}/><QuestionMediaList items={media.filter((item)=>item.role==="question")}/>
    {correct===undefined&&<section className="confidence-row"><span>確信度</span><div className="segmented">{Object.entries(CONFIDENCE_LABELS).map(([value,label])=><label key={value}><input type="radio" checked={confidence===value} onChange={()=>setConfidence(value as Confidence)}/>{label}</label>)}</div></section>}
    <section className="choice-list" aria-label="選択肢">{choices.map((choice)=>{const selected=answers.includes(choice.label);const graded=correct!==undefined;const answer=correctLabels.has(choice.label);return <button type="button" className={`answer-tile${selected?" is-selected":""}${graded&&answer?" is-correct-answer":""}${graded&&selected&&!answer?" is-wrong-answer":""}`} aria-pressed={selected} disabled={graded} onClick={()=>void toggle(choice.label)} key={choice.id}><span className="answer-label">{choice.label}</span><span>{choice.text}</span></button>})}</section>
    {correct===undefined&&multiple&&<button className="button primary-action" disabled={!answers.length} onClick={()=>void grade()}>回答を確定</button>}
    {correct!==undefined && <section className={`result-panel ${correct?"is-correct":"is-wrong"}`}><div className={correct?"success":"error"} style={{fontSize:"1.2rem",fontWeight:800}}>{correct?"正解":"不正解"}</div><div><b>正解：</b>{Array.isArray(question.correctAnswer)?question.correctAnswer.join(", "):question.correctAnswer}</div>{question.explanation&&<div><b>解説</b><p style={{whiteSpace:"pre-wrap",lineHeight:1.7}}>{question.explanation}</p></div>}<SafeTable html={question.explanationTableHtml}/><QuestionMediaList items={media.filter((item)=>item.role==="explanation")}/></section>}
    {attemptId&&needsAnalysis&&!analysisSaved&&<section className="card stack" style={{marginTop:12}}><div><h2 style={{marginBottom:4}}>A〜Fで振り返る</h2><p className="muted tiny" style={{margin:0}}>{correct?"迷った理由を残せます（任意）":"primary reasonを選んでください。後回しにもできます。"}</p></div>
      <div className="stack">{Object.entries(ERROR_LABELS).map(([value,label])=><label className="choice" key={value}><input type="radio" name="reason" checked={primary===value} onChange={()=>setPrimary(value as ErrorReason)}/><b>{value}</b><span>{label}</span></label>)}</div>
      {primary&&<div className="field"><span>副次的な理由（複数可）</span><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{(Object.keys(ERROR_LABELS) as ErrorReason[]).filter((x)=>x!==primary).map((x)=><label className="pill" key={x}><input type="checkbox" checked={secondary.includes(x)} onChange={()=>setSecondary((old)=>old.includes(x)?old.filter((v)=>v!==x):[...old,x])}/>{x}</label>)}</div></div>}
      {primary==="F"&&<select className="select" value={reading??""} onChange={(e)=>setReading(e.target.value as ReadingMistakeType)}><option value="">読み落としパターンを選択</option>{readingOptions.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>}
      <textarea className="textarea" placeholder="短いメモ（任意）" value={note} onChange={(e)=>setNote(e.target.value)}/><button className="button" disabled={!primary} onClick={saveAnalysis}>分類を保存</button>
    </section>}
    {attemptId&&<div className="grid-2" style={{marginTop:12}}><button className="button secondary" onClick={()=>setCardOpen(true)}><Plus size={18}/>カード</button><button className="button ghost" onClick={copyTemplate}><Clipboard size={18}/>相談コピー</button></div>}
    {message&&<p className="success tiny">{message}</p>}<QuestionNavigation hasPrevious={hasPrevious} hasNext={hasNext} onMove={move} position="bottom"/>
    {cardOpen&&<CardModal questionId={question.id} subject={question.subject} initialReason={primary} onClose={()=>setCardOpen(false)} onSaved={()=>{setCardOpen(false);setMessage("カードを作成しました")}}/>}
  </>;
}

function CardModal({questionId,subject,initialReason,onClose,onSaved}:{questionId:string;subject:"information"|"medical"|"system";initialReason?:ErrorReason;onClose:()=>void;onSaved:()=>void}){
  const [front,setFront]=useState(""),[back,setBack]=useState(""),[type,setType]=useState<CardType>("term"),[tags,setTags]=useState(""),[important,setImportant]=useState(false),[sourceReason,setSourceReason]=useState<ErrorReason|"">(initialReason??"");
  async function save(){const now=isoNow(),id=makeId();const due=new Date();due.setDate(due.getDate()+1);await db.cards.add({id,questionId,subject,cardType:type,front:front.trim(),back:back.trim(),tags:tags.split(",").map((x)=>x.trim()).filter(Boolean),dueAt:due.toISOString(),intervalDays:1,reviewCount:0,successCount:0,failureCount:0,isImportant:important,sourceReason:sourceReason||undefined,createdAt:now,updatedAt:now});await ensureSchedule("card",id,1);onSaved()}
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal stack"><div style={{display:"flex",justifyContent:"space-between"}}><div><p className="eyebrow">Memory card</p><h2>論点をカード化</h2></div><button className="button ghost" onClick={onClose} aria-label="閉じる"><X size={18}/></button></div><div className="notice">問題文を丸ごと写さず、自分の言葉でまとめましょう。</div><select className="select" value={type} onChange={(e)=>setType(e.target.value as CardType)}>{Object.entries(CARD_TYPE_LABELS).map(([v,l])=><option value={v} key={v}>{l}カード</option>)}</select><select className="select" value={sourceReason} onChange={(e)=>setSourceReason(e.target.value as ErrorReason|"")}><option value="">A〜F由来なし</option>{Object.entries(ERROR_LABELS).map(([v,l])=><option value={v} key={v}>{v}: {l}</option>)}</select><label className="field">表面<input className="input" value={front} onChange={(e)=>setFront(e.target.value)}/></label><label className="field">裏面<textarea className="textarea" value={back} onChange={(e)=>setBack(e.target.value)}/></label><label className="field">タグ（カンマ区切り）<input className="input" value={tags} onChange={(e)=>setTags(e.target.value)}/></label><label className="choice"><input type="checkbox" checked={important} onChange={(e)=>setImportant(e.target.checked)}/><Brain size={19}/><span>試験前週に再表示する重要カード</span></label><button className="button" disabled={!front.trim()||!back.trim()} onClick={save}>カードを保存</button></div></div>
}
export default function PracticePage(){return <Suspense><Practice/></Suspense>}
