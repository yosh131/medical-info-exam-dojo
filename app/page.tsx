"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { ArrowRight, BookOpen, Download, Layers3, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/lib/db";

export default function HomePage() {
  const data = useLiveQuery(async () => {
    const [questionRows, attempts, analyses, due, exam, backup] = await Promise.all([
      db.questions.toArray(), db.attempts.toArray(), db.errorAnalyses.toArray(),
      db.reviewSchedules.where("dueAt").belowOrEqual(new Date().toISOString()).count(), db.settings.get("examDate"), db.settings.get("lastBackupAt")
    ]);
    const years = [...new Set(questionRows.map((q) => q.examYear))].sort((a,b)=>b-a).slice(0,5);
    const target = questionRows.filter((q) => years.includes(q.examYear));
    const answeredIds = new Set(attempts.map((a) => a.questionId));
    const answered = target.filter((q) => answeredIds.has(q.id)).length;
    const pending = attempts.filter((a) => !a.isCorrect && !analyses.some((x) => x.attemptId === a.id)).length;
    const recent = attempts.slice().sort((a,b)=>b.attemptedAt.localeCompare(a.attemptedAt)).slice(0,20);
    const accuracy = recent.length ? Math.round(recent.filter((a)=>a.isCorrect).length / recent.length * 100) : 0;
    const examDate = typeof exam?.value === "string" ? exam.value : undefined;
    const days = examDate ? differenceInCalendarDays(startOfDay(new Date(examDate)), startOfDay(new Date())) : undefined;
    const lastBackup = typeof backup?.value === "string" ? new Date(backup.value) : undefined;
    const backupDue = questionRows.length > 0 && (!lastBackup || Date.now() - lastBackup.getTime() > 7 * 86400000);
    return { questions: target.length, answered, due, pending, accuracy, days, backupDue };
  }, []);
  const d = data ?? { questions:0, answered:0, due:0, pending:0, accuracy:0, days:undefined, backupDue:false };
  const progress = d.questions ? Math.round(d.answered / d.questions * 100) : 0;

  return <><PageHeader eyebrow="Medical Information" title="今日も一問ずつ。" settings/>
    <section className="card" style={{background:"linear-gradient(145deg,#0b6b58,#075244)",color:"white",marginBottom:12}}>
      <div className="tiny" style={{opacity:.75}}>試験日まで</div>
      <div className="metric">{d.days === undefined ? "未設定" : d.days >= 0 ? `あと ${d.days} 日` : "試験日経過"}</div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:18,fontSize:13}}><span>5年分の進捗</span><b>{progress}%</b></div>
      <div className="progress" style={{marginTop:7,background:"rgba(255,255,255,.2)"}}><i style={{width:`${progress}%`,background:"#f3c45e"}}/></div>
    </section>
    <section className="grid-2" style={{marginBottom:12}}>
      <Link href="/review" className="card" style={{textDecoration:"none",color:"inherit"}}><span className="pill"><Sparkles size={14}/>今日</span><div className="metric" style={{marginTop:8}}>{d.due}</div><div className="muted tiny">復習する項目</div></Link>
      <div className="card"><span className="pill">直近20問</span><div className="metric" style={{marginTop:8}}>{d.accuracy}%</div><div className="muted tiny">正答率</div></div>
    </section>
    {d.pending > 0 && <Link href="/questions?filter=pending" className="notice" style={{display:"flex",justifyContent:"space-between",color:"inherit",textDecoration:"none",marginBottom:12}}>未完了の誤答分類が {d.pending} 件あります <ArrowRight size={18}/></Link>}
    {d.backupDue && <Link href="/settings" className="notice" style={{display:"flex",justifyContent:"space-between",color:"inherit",textDecoration:"none",marginBottom:12}}>バックアップを保存しておきましょう <ArrowRight size={18}/></Link>}
    <section className="card stack">
      <h2>すぐ始める</h2>
      <Link href="/practice" className="button"><BookOpen size={19}/>問題を解く</Link>
      <Link href="/cards" className="button ghost"><Layers3 size={19}/>カードを管理</Link>
      <Link href="/import" className="button secondary"><Download size={19}/>問題をインポート</Link>
    </section>
  </>;
}
