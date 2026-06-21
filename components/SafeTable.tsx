"use client";
import { useEffect, useState } from "react";
import { sanitizeTableHtml } from "@/lib/tableSanitizer";

export function SafeTable({html}:{html?:string}){
  const [safe,setSafe]=useState("");
  useEffect(()=>{let active=true;if(!html){setSafe("");return}import("dompurify").then(({default:purify})=>{if(active)setSafe(sanitizeTableHtml(purify,html))});return()=>{active=false}},[html]);
  if(!safe)return null;
  return <div className="table-scroll" dangerouslySetInnerHTML={{__html:safe}}/>;
}
