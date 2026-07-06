import { existsSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const publicDir = resolve("public");
const forbiddenExtensions = new Set([".zip", ".db", ".sqlite", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const violations: string[] = [];

function scan(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const name = relative(publicDir, path).replaceAll("\\", "/");
    if (name === "__debug__" || name.startsWith("__debug__/")) violations.push(name);
    if (entry.isDirectory()) scan(path);
    else if (forbiddenExtensions.has(extname(entry.name).toLowerCase())) violations.push(name);
  }
}

if (existsSync(publicDir)) scan(publicDir);
const unique = [...new Set(violations)];
if (unique.length) {
  console.error("Private/debug data detected under public/. Remove it before building:");
  unique.forEach((path) => console.error(`- ${path}`));
  process.exit(1);
}
console.log("Public data safety check passed.");
