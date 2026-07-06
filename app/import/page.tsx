"use client";
import { useState } from "react";
import { Beaker, CheckCircle2, FileJson, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { commitImport, previewBundle, type ImportPreview } from "@/lib/importer";

export default function ImportPage() {
  const [preview,setPreview]=useState<ImportPreview>(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [done,setDone]=useState<number>();
  async function select(file?: File) {
    if (!file) return; setBusy(true); setError(""); setDone(undefined);
    try { setPreview(await previewBundle(file)); } catch(e) { setPreview(undefined); setError(e instanceof Error ? e.message : "読み込めませんでした"); } finally { setBusy(false); }
  }
  async function loadDebugSeed() {
    setBusy(true); setError(""); setDone(undefined);
    try {
      const response=await fetch("/__debug__/questions.zip",{cache:"no-store"});
      if(!response.ok)throw new Error("デバッグデータがありません。先に npm run debug:seed を実行してください。");
      await select(new File([await response.blob()],"debug-questions.zip",{type:"application/zip"}));
    } catch(e) { setPreview(undefined); setError(e instanceof Error?e.message:"デバッグデータを読み込めませんでした"); }
    finally { setBusy(false); }
  }
  async function commit() { if (!preview) return; setBusy(true); try { setDone(await commitImport(preview)); setPreview(undefined); } catch { setError("登録中に競合が発生しました。もう一度ファイルを確認してください。"); } finally { setBusy(false); } }
  return <><PageHeader eyebrow="Local import" title="問題を取り込む"/>
    <div className="notice" style={{marginBottom:12}}>ファイルはこの端末内だけで処理され、外部へ送信されません。</div>
    <label className="card" style={{display:"grid",placeItems:"center",gap:12,minHeight:170,textAlign:"center",cursor:"pointer"}}>
      <FileJson size={38} color="#0b6b58"/><div><b>問題バンドルZIPを選択</b><div className="muted tiny">問題・表・画像・PDFをまとめて取り込みます</div></div>
      <input type="file" accept="application/zip,.zip" hidden onChange={(e)=>select(e.target.files?.[0])}/>
    </label>
    {process.env.NODE_ENV==="development"&&<section className="debug-seed"><div><b><Beaker size={17}/> ローカルデバッグ</b><p>非公開の少量データを読み込みます。本番には表示されません。</p></div><button className="button secondary" disabled={busy} onClick={loadDebugSeed}>デバッグデータを読み込む</button></section>}
    {busy && <p className="muted">ローカルで検証しています…</p>}{error && <p className="error">{error}</p>}
    {done !== undefined && <div className="card success" style={{marginTop:12}}><CheckCircle2 size={20}/> {done}問を登録しました。</div>}
    {preview && <section className="stack" style={{marginTop:16}}>
      <div className="grid-2"><div className="card"><div className="metric">{preview.ready}</div><div className="muted tiny">登録可能</div></div><div className="card"><div className="metric">{preview.mediaCount}</div><div className="muted tiny">メディア</div></div><div className="card"><div className="metric">{preview.duplicate}</div><div className="muted tiny">重複スキップ</div></div><div className="card"><div className="metric">{preview.conflict + preview.invalid}</div><div className="muted tiny">要修正</div></div></div>
      {preview.rows.some((r)=>r.message) && <div className="card"><h2>確認事項</h2>{preview.rows.filter((r)=>r.message).slice(0,20).map((r)=><div className="list-row tiny" key={r.index}><b>#{r.index+1}</b><span className={r.status==="invalid"||r.status==="conflict"?"error":"muted"}>{r.message}</span></div>)}</div>}
      <button className="button" disabled={!preview.ready||busy} onClick={commit}><Upload size={18}/>{preview.ready}問をインポート</button>
    </section>}
  </>;
}
