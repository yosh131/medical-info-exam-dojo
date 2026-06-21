import Link from "next/link";
import { Settings } from "lucide-react";

export function PageHeader({ eyebrow, title, settings = false }: { eyebrow: string; title: string; settings?: boolean }) {
  return <header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{settings && <Link className="button ghost" href="/settings" aria-label="設定"><Settings size={20}/></Link>}</header>;
}
