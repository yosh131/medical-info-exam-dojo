import Link from "next/link";
import { Settings } from "lucide-react";
import { AppMenu } from "./AppMenu";

export function PageHeader({ eyebrow, title, settings = false }: { eyebrow?: string; title: string; settings?: boolean }) {
  return <header className="page-head"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div><div className="header-actions">{settings && <Link className="icon-button" href="/settings" aria-label="設定"><Settings size={20}/></Link>}<AppMenu/></div></header>;
}
