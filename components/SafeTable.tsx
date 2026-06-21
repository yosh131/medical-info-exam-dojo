"use client";
import { useEffect, useState } from "react";

const ALLOWED_TAGS = ["table","thead","tbody","tfoot","tr","th","td","caption","colgroup","col","br","span","strong","em","sup","sub"];
const ALLOWED_ATTR = ["rowspan","colspan","scope"];

export function SafeTable({html}:{html?:string}){
  const [safe,setSafe]=useState("");
  useEffect(()=>{let active=true;if(!html){setSafe("");return}import("dompurify").then(({default:purify})=>{if(active)setSafe(purify.sanitize(html,{ALLOWED_TAGS,ALLOWED_ATTR}))});return()=>{active=false}},[html]);
  if(!safe)return null;
  return <div className="table-scroll" dangerouslySetInnerHTML={{__html:safe}}/>;
}
