"use client";

import Link from "next/link";
import { BarChart3, BookOpenCheck, Home, Library, Menu, RotateCcw, Settings, Upload, X, WalletCards } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const practiceStorageKey = "lastPracticeHref";

const staticItems = [
  { href: "/", label: "ホーム", description: "進捗と今日の入口", icon: Home },
  { href: "/questions", label: "問題一覧", description: "年度・分類で探す", icon: Library },
  { href: "/review", label: "復習", description: "期限到来とA〜F別復習", icon: RotateCcw },
  { href: "/dashboard", label: "分析", description: "正答率と弱点", icon: BarChart3 },
  { href: "/cards", label: "カード", description: "暗記カード", icon: WalletCards },
  { href: "/import", label: "取り込み", description: "問題ZIPをインポート", icon: Upload },
  { href: "/settings", label: "設定", description: "バックアップ・試験日", icon: Settings }
];

function normalizePath(raw: string) {
  return raw.startsWith(basePath) ? raw.slice(basePath.length) || "/" : raw;
}

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const [practiceHref, setPracticeHref] = useState("/practice");
  const rawPathname = usePathname();
  const pathname = normalizePath(rawPathname);

  useEffect(() => {
    const stored = localStorage.getItem(practiceStorageKey);
    if (stored?.startsWith("/practice?")) setPracticeHref(stored);
  }, []);

  const practiceItem = useMemo(() => ({
    href: practiceHref,
    label: practiceHref === "/practice" ? "演習" : "演習に戻る",
    description: practiceHref === "/practice" ? "出題設定から開始" : "直前の問題を再開",
    icon: BookOpenCheck
  }), [practiceHref]);

  const items = [staticItems[0], practiceItem, ...staticItems.slice(1)];

  return <>
    <button className="icon-button" type="button" aria-label="メニューを開く" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21}/></button>
    {open && <div className="drawer-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <aside className="app-drawer" role="dialog" aria-modal="true" aria-label="メニュー" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head"><div><p className="eyebrow">Menu</p><h2>移動先</h2></div><button className="icon-button" type="button" aria-label="メニューを閉じる" onClick={() => setOpen(false)}><X size={20}/></button></div>
        <nav className="drawer-nav">{items.map(({ href, label, description, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);
          return <Link className={`drawer-link${active ? " active" : ""}`} href={href} key={`${label}-${href}`} onClick={() => setOpen(false)}><Icon size={20}/><span><b>{label}</b><small>{description}</small></span></Link>;
        })}</nav>
      </aside>
    </div>}
  </>;
}
