"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Brain, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clipboard, Plus, Shuffle, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { QuestionMediaList } from "@/components/QuestionMedia";
import { SafeTable } from "@/components/SafeTable";
import { db, isoNow, makeId } from "@/lib/db";
import { isCorrectAnswer } from "@/lib/importer";
import { ensureSchedule } from "@/lib/scheduler";
import { createConsultationTemplate } from "@/lib/chatgpt";
import { adjacentQuestion, filterPracticeQuestions, shufflePracticeQuestions, sortPracticeQuestions } from "@/lib/practiceNavigation";
import { formatExplanationText, stripDuplicatedChoices } from "@/lib/questionText";
import { toggleAnswerSelection, UNKNOWN_ANSWER } from "@/lib/answerSelection";
import { filterQuestionsByPracticeMode, summarizeProgress, summarizeProgressByCategory, type PracticeMode, type ProgressSummary } from "@/lib/practiceStats";
import { filterQuestionsByReason, isErrorReason } from "@/lib/reasonFilters";
import { CARD_TYPE_LABELS, ERROR_LABELS, SUBJECT_LABELS, type Attempt, type Card, type CardType, type ErrorAnalysis, type ErrorReason, type Question, type ReadingMistakeType, type Subject } from "@/lib/types";

const readingOptions: [ReadingMistakeType,string][] = [["missed_negative","誤っているものを読み落とした"],["missed_positive","正しいものを読み落とした"],["missed_best_answer","最も適切を見落とした"],["wrong_subject","主体を取り違えた"],["missed_condition","時点・条件を見落とした"],["missed_number_or_unit","数値・単位を読み落とした"],["other","その他"]];

function QuestionNavigation({hasPrevious,hasNext,onMove,position}:{hasPrevious:boolean;hasNext:boolean;onMove:(direction:-1|1)=>void;position:"top"|"bottom"}){
  return <nav className={`question-nav ${position}`} aria-label={`${position==="top"?"上部":"下部"}の問題移動`}><button className="button ghost" disabled={!hasPrevious} onClick={()=>onMove(-1)}><ChevronLeft size={18}/>前の問題</button><button className="button" disabled={!hasNext} onClick={()=>onMove(1)}>次の問題<ChevronRight size={18}/></button></nav>;
}

const subjectOrder: Subject[] = ["information", "system", "medical"];

const practiceModeOptions: Array<{value:PracticeMode; label:string; help:string}> = [
  { value:"all", label:"全問", help:"選択範囲すべて" },
  { value:"unanswered", label:"未解答", help:"まだ解いていない問題" },
  { value:"wrong", label:"誤答", help:"直近で不正解・わからない" },
  { value:"flagged", label:"フラグ", help:"重要カード付き" }
];

function percent(value:number,total:number){return total?Math.round(value/total*100):0}

function ProgressMiniBar({summary}:{summary:ProgressSummary}) {
  return <div className="progress-stack" aria-label={`未解答${summary.unanswered}問、誤答${summary.wrong}問、正解${summary.correct}問`}>
    <i className="is-unanswered" style={{width:`${percent(summary.unanswered,summary.total)}%`}}/>
    <i className="is-wrong" style={{width:`${percent(summary.wrong,summary.total)}%`}}/>
    <i className="is-correct" style={{width:`${percent(summary.correct,summary.total)}%`}}/>
  </div>
}

function PracticeSetup({data,initialReason}:{data:{questions:Question[];attempts:Attempt[];cards:Card[];analyses:ErrorAnalysis[]}|undefined;initialReason?:ErrorReason}) {
  const router=useRouter();
  const questions=data?.questions;
  const attempts=data?.attempts??[];
  const cards=data?.cards??[];
  const analyses=data?.analyses??[];
  const years=useMemo(()=>[...new Set((questions??[]).map((question)=>question.examYear))].sort((a,b)=>b-a),[questions]);
  const subjects=useMemo(()=>subjectOrder.filter((subject)=>(questions??[]).some((question)=>question.subject===subject)),[questions]);
  const [selectedYears,setSelectedYears]=useState<number[]>([]); const [selectedSubjects,setSelectedSubjects]=useState<Subject[]>([]); const [mode,setMode]=useState<PracticeMode>("all"); const [reason,setReason]=useState<ErrorReason|"">(initialReason??"");
  const baseMatching=useMemo(()=>filterQuestionsByReason(filterPracticeQuestions(questions??[],new Set(selectedYears),new Set(selectedSubjects)),analyses,reason||undefined),[analyses,questions,reason,selectedSubjects,selectedYears]);
  const matching=useMemo(()=>filterQuestionsByPracticeMode(baseMatching,attempts,cards,mode),[attempts,baseMatching,cards,mode]);
  const overall=useMemo(()=>summarizeProgress(questions??[],attempts),[attempts,questions]);
  const categories=useMemo(()=>summarizeProgressByCategory(questions??[],attempts),[attempts,questions]);
  function toggleYear(year:number){setSelectedYears((current)=>current.includes(year)?current.filter((item)=>item!==year):[...current,year])}
  function toggleSubject(subject:Subject){setSelectedSubjects((current)=>current.includes(subject)?current.filter((item)=>item!==subject):[...current,subject])}
  function selectCategory(year:number,subject:Subject){setSelectedYears([year]);setSelectedSubjects([subject])}
  function start(){
    if(!matching.length)return;
    const seed=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;
    const session=shufflePracticeQuestions(matching,seed); const sessionId=`practice:${seed}`;
    try{sessionStorage.setItem(sessionId,JSON.stringify(session.map((question)=>question.id)))}catch{}
    const next=new URLSearchParams();
    next.set("id",session[0].id); next.set("years",selectedYears.slice().sort((a,b)=>b-a).join(",")); next.set("subjects",subjectOrder.filter((subject)=>selectedSubjects.includes(subject)).join(",")); next.set("mode",mode); if(reason)next.set("reason",reason); next.set("seed",seed); next.set("session",sessionId);
    router.push(`/practice?${next.toString()}`);
  }
  if(data===undefined)return <><PageHeader eyebrow="Practice" title="出題設定"/><div className="card"><p>問題を読み込んでいます。</p></div></>;
  if(!questions?.length)return <><PageHeader eyebrow="Practice" title="出題設定"/><div className="card"><p>問題がまだありません。</p><a className="button" href="../import">インポートへ</a></div></>;
  return <><PageHeader eyebrow="Practice" title="出題設定"/><section className="practice-setup">
    <div className="progress-overview"><div><b>全体進捗</b><span>{percent(overall.wrong+overall.correct,overall.total)}% 解答済み</span></div><ProgressMiniBar summary={overall}/><div className="progress-legend"><span><i className="is-unanswered"/>未解答 {overall.unanswered}</span><span><i className="is-wrong"/>誤答 {overall.wrong}</span><span><i className="is-correct"/>正解 {overall.correct}</span></div></div>
    <div className="filter-group"><div className="filter-heading"><h2>年度</h2><span>未選択から開始</span></div><div className="filter-grid years">{years.map((year)=><button type="button" className={`filter-tile${selectedYears.includes(year)?" is-selected":""}`} aria-pressed={selectedYears.includes(year)} onClick={()=>toggleYear(year)} key={year}>{year}年度</button>)}</div></div>
    <div className="filter-group"><div className="filter-heading"><h2>ジャンル</h2><span>複数選択可</span></div><div className="filter-grid subjects">{subjects.map((subject)=><button type="button" className={`filter-tile${selectedSubjects.includes(subject)?" is-selected":""}`} aria-pressed={selectedSubjects.includes(subject)} onClick={()=>toggleSubject(subject)} key={subject}>{SUBJECT_LABELS[subject]}</button>)}</div></div>
    <div className="filter-group"><div className="filter-heading"><h2>出題モード</h2><span>選択範囲に適用</span></div><div className="mode-grid">{practiceModeOptions.map((option)=><button type="button" className={`mode-tile${mode===option.value?" is-selected":""}`} aria-pressed={mode===option.value} onClick={()=>setMode(option.value)} key={option.value}><b>{option.label}</b><small>{option.help}</small></button>)}</div></div>
    <div className="filter-group"><div className="filter-heading"><h2>A〜F分類</h2><span>任意</span></div><div className="reason-chip-grid"><button type="button" className={`reason-chip${reason===""?" is-selected":""}`} aria-pressed={reason===""} onClick={()=>setReason("")}>全分類</button>{(Object.keys(ERROR_LABELS) as ErrorReason[]).map((key)=><button type="button" className={`reason-chip${reason===key?" is-selected":""}`} aria-pressed={reason===key} onClick={()=>setReason(key)} key={key}><b>{key}</b><small>{ERROR_LABELS[key]}</small></button>)}</div></div>
    <details className="category-progress" open><summary>カテゴリ別進捗</summary><div>{categories.map((category)=><button type="button" className="category-progress-row" onClick={()=>selectCategory(category.examYear,category.subject)} key={`${category.examYear}-${category.subject}`}><span><b>{category.examYear}年</b> {SUBJECT_LABELS[category.subject]}</span><ProgressMiniBar summary={category}/><small>解答済み {percent(category.wrong+category.correct,category.total)}% ・ 未{category.unanswered} / 誤{category.wrong} / 正{category.correct}</small></button>)}</div></details>
    <div className="setup-summary"><div><b>{matching.length}問</b><span>{selectedYears.length&&selectedSubjects.length?"選択条件からランダム出題":"年度とジャンルを選んでください"}</span></div><button className="button" disabled={!matching.length} onClick={start}><Shuffle size={18}/>演習を開始</button></div>
  </section></>;
}

function Practice() {
  const params=useSearchParams(), router=useRouter(); const requested=params.get("id");
  const initialReason=isErrorReason(params.get("reason"))?params.get("reason") as ErrorReason:undefined;
  const practiceData=useLiveQuery(async()=>({questions:sortPracticeQuestions(await db.questions.toArray()),attempts:await db.attempts.toArray(),cards:await db.cards.toArray(),analyses:await db.errorAnalyses.toArray()}),[]); const all=practiceData?.questions??[];
  const question=useLiveQuery(()=>requested?db.questions.get(requested):undefined,[requested],null);
  const sessionKey=params.toString();
  const sessionQuestions=useMemo(()=>{
    const sessionParams=new URLSearchParams(sessionKey); const sessionId=sessionParams.get("session"), seed=sessionParams.get("seed"), yearsValue=sessionParams.get("years"), subjectsValue=sessionParams.get("subjects"), modeValue=sessionParams.get("mode") as PracticeMode | null, reasonValue=sessionParams.get("reason");
    if(sessionId&&typeof window!=="undefined"){try{const ids=JSON.parse(window.sessionStorage.getItem(sessionId)??"[]") as string[];if(ids.length){const byId=new Map(all.map((item)=>[item.id,item]));return ids.map((id)=>byId.get(id)).filter((item):item is Question=>Boolean(item))}}catch{}}
    if(!seed||!yearsValue||!subjectsValue)return all;
    const years=new Set(yearsValue.split(",").map(Number).filter(Number.isFinite)); const subjects=new Set(subjectsValue.split(",").filter((value):value is Subject=>subjectOrder.includes(value as Subject)));
    const mode:PracticeMode=modeValue==="unanswered"||modeValue==="wrong"||modeValue==="flagged"?modeValue:"all";
    const reason=isErrorReason(reasonValue)?reasonValue:undefined;
    return shufflePracticeQuestions(filterQuestionsByPracticeMode(filterQuestionsByReason(filterPracticeQuestions(all,years,subjects),practiceData?.analyses??[],reason),practiceData?.attempts??[],practiceData?.cards??[],mode),seed);
  },[all,practiceData?.analyses,practiceData?.attempts,practiceData?.cards,sessionKey]);
  const choices=useLiveQuery(()=>question?db.choices.where("questionId").equals(question.id).sortBy("label"):[],[question?.id])??[];
  const media=useLiveQuery(()=>question?db.questionMedia.where("questionId").equals(question.id).sortBy("order"):[],[question?.id])??[];
  const [answers,setAnswers]=useState<string[]>([]); const [unknownSelected,setUnknownSelected]=useState(false); const [attemptId,setAttemptId]=useState<string>(); const [correct,setCorrect]=useState<boolean>(); const [grading,setGrading]=useState(false); const [analysisOpen,setAnalysisOpen]=useState(false); const started=useRef(Date.now()); const resultRef=useRef<HTMLElement>(null);
  const [primary,setPrimary]=useState<ErrorReason>(); const [secondary,setSecondary]=useState<ErrorReason[]>([]); const [reading,setReading]=useState<ReadingMistakeType>(); const [note,setNote]=useState(""); const [analysisSaved,setAnalysisSaved]=useState(false); const [cardOpen,setCardOpen]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{setAnswers([]);setUnknownSelected(false);setAttemptId(undefined);setCorrect(undefined);setGrading(false);setAnalysisOpen(false);setPrimary(undefined);setSecondary([]);setReading(undefined);setNote("");setAnalysisSaved(false);setCardOpen(false);setMessage("");started.current=Date.now()},[question?.id]);
  useEffect(()=>{if(correct!==undefined)requestAnimationFrame(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}))},[correct]);
  const multiple=question?Array.isArray(question.correctAnswer)||question.questionType==="multiple_choice":false;
  function toggle(label:string){if(correct!==undefined||grading)return;setUnknownSelected(false);setAnswers((current)=>toggleAnswerSelection(current,label,multiple))}
  function toggleUnknown(){if(correct!==undefined||grading)return;setAnswers([]);setUnknownSelected((current)=>!current)}
  async function grade(){if(!question||(!answers.length&&!unknownSelected)||grading||correct!==undefined)return;setGrading(true);try{const isCorrect=!unknownSelected&&isCorrectAnswer(answers,question.correctAnswer);const id=makeId();const userAnswer=unknownSelected?UNKNOWN_ANSWER:(multiple?answers:answers[0]);await db.attempts.add({id,questionId:question.id,userAnswer,isCorrect,confidence:unknownSelected?"low":"high",elapsedSec:Math.round((Date.now()-started.current)/1000),attemptedAt:isoNow()});setAttemptId(id);setCorrect(isCorrect);if(!isCorrect)await ensureSchedule("question",question.id,1)}finally{setGrading(false)}}
  async function saveAnalysis(){if(!question||!attemptId||!primary)return;await db.errorAnalyses.add({id:makeId(),attemptId,questionId:question.id,primaryReason:primary,secondaryReasons:secondary.filter((x)=>x!==primary),readingMistakeType:primary==="F"?reading:undefined,note:note.trim()||undefined,createdAt:isoNow()});setAnalysisSaved(true);setMessage("分類を保存しました")}
  async function copyTemplate(){if(!question)return;if(!window.confirm("問題文・選択肢を含むテンプレートをクリップボードへコピーします。外部サービスへの送信はご自身で判断してください。"))return;await navigator.clipboard.writeText(createConsultationTemplate(question,choices,unknownSelected?"わからない":multiple?answers:answers[0]));setMessage("相談テンプレートをコピーしました")}
  function move(direction:-1|1){if(!question)return;const target=adjacentQuestion(sessionQuestions,question.id,direction);if(target){const next=new URLSearchParams(params.toString());next.set("id",target.id);router.push(`/practice?${next.toString()}`)}}
  if(!requested)return <PracticeSetup data={practiceData} initialReason={initialReason}/>;
  if(question===null)return <><PageHeader eyebrow="Practice" title="問題演習"/><div className="card"><p>問題を読み込んでいます。</p></div></>;
  if(!question)return <><PageHeader eyebrow="Practice" title="問題演習"/><div className="card"><p>指定された問題が見つかりません。</p><a className="button" href="../practice">出題設定へ</a></div></>;
  const needsAnalysis=correct===false||analysisOpen;
  const currentIndex=sessionQuestions.findIndex((item)=>item.id===question.id); const hasPrevious=currentIndex>0; const hasNext=currentIndex>=0&&currentIndex<sessionQuestions.length-1;
  const correctLabels=new Set(Array.isArray(question.correctAnswer)?question.correctAnswer:[question.correctAnswer]);
  const displayedBody=stripDuplicatedChoices(question.body,choices); const displayedExplanation=question.explanation?formatExplanationText(question.explanation):undefined;
  return <><PageHeader eyebrow={`${question.examYear} / ${SUBJECT_LABELS[question.subject]} · ${currentIndex+1} / ${sessionQuestions.length}`} title={`問 ${question.questionNo}`}/>
    <QuestionNavigation hasPrevious={hasPrevious} hasNext={hasNext} onMove={move} position="top"/>
    <article className="question-body">{displayedBody}</article>
    <SafeTable html={question.bodyTableHtml}/><QuestionMediaList items={media.filter((item)=>item.role==="question")}/>
    <section className="choice-list" aria-label="選択肢">{choices.map((choice)=>{const selected=answers.includes(choice.label);const graded=correct!==undefined;const answer=correctLabels.has(choice.label);return <button type="button" className={`answer-tile${selected?" is-selected":""}${graded&&answer?" is-correct-answer":""}${graded&&selected&&!answer?" is-wrong-answer":""}`} aria-pressed={selected} disabled={graded} onClick={()=>toggle(choice.label)} key={choice.id}><span className="answer-check" aria-hidden="true">{selected&&<Check size={17}/>}</span><span className="answer-label">{choice.label}</span><span>{choice.text}</span></button>})}
      <button type="button" className={`answer-tile unknown-answer${unknownSelected?" is-selected":""}${correct!==undefined&&unknownSelected?" is-wrong-answer":""}`} aria-pressed={unknownSelected} disabled={correct!==undefined} onClick={toggleUnknown}><span className="answer-check" aria-hidden="true">{unknownSelected&&<Check size={17}/>}</span><span className="answer-label"><CircleHelp size={18}/></span><span><b>わからない</b><small>答えを推測せず、復習対象として記録</small></span></button>
    </section>
    {correct===undefined&&<button className="button primary-action" disabled={(!answers.length&&!unknownSelected)||grading} onClick={()=>void grade()}>{grading?"採点中…":"この内容で回答する"}</button>}
    {correct!==undefined && <section ref={resultRef} role="status" aria-live="polite" className={`result-panel result-reveal ${correct?"is-correct":"is-wrong"}`}><div className="result-verdict">{correct?<CheckCircle2 aria-hidden="true"/>:<XCircle aria-hidden="true"/>}<strong>{unknownSelected?"わからないとして記録しました":correct?"正解です":"不正解です"}</strong></div><div><b>正解：</b>{Array.isArray(question.correctAnswer)?question.correctAnswer.join(", "):question.correctAnswer}</div>{displayedExplanation&&<div><b>この問題の解説</b><p className="explanation-text">{displayedExplanation}</p></div>}<SafeTable html={question.explanationTableHtml}/><QuestionMediaList items={media.filter((item)=>item.role==="explanation")}/></section>}
    {attemptId&&needsAnalysis&&!analysisSaved&&<section className="card stack" style={{marginTop:12}}><div><h2 style={{marginBottom:4}}>A〜Fで振り返る</h2><p className="muted tiny" style={{margin:0}}>{correct?"迷った理由を残せます（任意）":"primary reasonを選んでください。後回しにもできます。"}</p></div>
      <div className="stack">{Object.entries(ERROR_LABELS).map(([value,label])=><label className="choice" key={value}><input type="radio" name="reason" checked={primary===value} onChange={()=>setPrimary(value as ErrorReason)}/><b>{value}</b><span>{label}</span></label>)}</div>
      {primary&&<div className="field"><span>副次的な理由（複数可）</span><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{(Object.keys(ERROR_LABELS) as ErrorReason[]).filter((x)=>x!==primary).map((x)=><label className="pill" key={x}><input type="checkbox" checked={secondary.includes(x)} onChange={()=>setSecondary((old)=>old.includes(x)?old.filter((v)=>v!==x):[...old,x])}/>{x}</label>)}</div></div>}
      {primary==="F"&&<select className="select" value={reading??""} onChange={(e)=>setReading(e.target.value as ReadingMistakeType)}><option value="">読み落としパターンを選択</option>{readingOptions.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>}
      <textarea className="textarea" placeholder="短いメモ（任意）" value={note} onChange={(e)=>setNote(e.target.value)}/><button className="button" disabled={!primary} onClick={saveAnalysis}>分類を保存</button>
    </section>}
    {attemptId&&correct===true&&!analysisOpen&&!analysisSaved&&<button className="button ghost primary-action" onClick={()=>setAnalysisOpen(true)}>A〜F分類を追加</button>}
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
