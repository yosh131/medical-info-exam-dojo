"use client";
import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { QuestionMedia as StoredMedia } from "@/lib/types";

function MediaItem({item}:{item:StoredMedia}){
  const [url,setUrl]=useState("");
  useEffect(()=>{const next=URL.createObjectURL(item.blob);setUrl(next);return()=>URL.revokeObjectURL(next)},[item.blob]);
  if(!url)return <div className="media-placeholder">メディアを準備中…</div>;
  if(item.mimeType==="application/pdf")return <a className="media-file" href={url} target="_blank" rel="noreferrer"><FileText size={24}/><span><b>{item.fileName}</b><small>PDFを開く</small></span><ExternalLink size={18}/></a>;
  return <figure className="question-media"><img src={url} alt={item.fileName}/><figcaption>{item.fileName}</figcaption></figure>;
}

export function QuestionMediaList({items}:{items:StoredMedia[]}){
  if(!items.length)return null;
  return <div className="media-list">{items.slice().sort((a,b)=>a.order-b.order).map((item)=><MediaItem item={item} key={item.id}/>)}</div>;
}
