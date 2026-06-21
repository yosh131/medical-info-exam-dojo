"use client";
import Link from "next/link";
import { BarChart3, BookOpenCheck, Home, Library, RotateCcw } from "lucide-react";
import { usePathname } from "next/navigation";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const items = [
  { href: "/", label: "ホーム", icon: Home }, { href: "/questions", label: "問題", icon: Library },
  { href: "/practice", label: "演習", icon: BookOpenCheck }, { href: "/review", label: "復習", icon: RotateCcw },
  { href: "/dashboard", label: "分析", icon: BarChart3 }
];
export function BottomNav() {
  const raw = usePathname(); const pathname = raw.startsWith(basePath) ? raw.slice(basePath.length) || "/" : raw;
  return <nav className="bottom-nav" aria-label="メインナビゲーション">{items.map(({href,label,icon:Icon}) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return <Link className={`nav-item ${active ? "active" : ""}`} href={href} key={href}><Icon size={21}/><span>{label}</span></Link>;
  })}</nav>;
}
