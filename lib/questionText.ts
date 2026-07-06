import type { Choice } from "./types";

type DisplayChoice = Pick<Choice, "label" | "text">;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compact(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function choiceMarker(label: string) {
  const circled = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
  const numeric = Number(label);
  const alternatives = [
    `${escapeRegExp(label)}[)）.．、:：]`,
    `[（(]${escapeRegExp(label)}[)）]`
  ];
  if (Number.isInteger(numeric) && circled[numeric]) alternatives.push(circled[numeric]);
  return `(?:${alternatives.join("|")})`;
}

export function stripDuplicatedChoices(body: string, choices: DisplayChoice[]) {
  if (!body.trim() || !choices.length) return body;
  const markers: Array<{ index: number; end: number }> = [];
  let cursor = 0;
  for (const choice of choices) {
    const pattern = new RegExp(`^[ \\t]*${choiceMarker(choice.label)}[ \\t]*`, "gm");
    pattern.lastIndex = cursor;
    const match = pattern.exec(body);
    if (!match) return body;
    markers.push({ index: match.index, end: pattern.lastIndex });
    cursor = pattern.lastIndex;
  }
  const allMatch = choices.every((choice, index) => {
    const end = markers[index + 1]?.index ?? body.length;
    return compact(body.slice(markers[index].end, end)) === compact(choice.text);
  });
  if (!allMatch) return body;
  const stem = body.slice(0, markers[0].index).trim();
  return stem || body;
}

function joiner(previous: string, next: string) {
  return /[A-Za-z0-9]$/.test(previous) && /^[A-Za-z0-9]/.test(next) ? " " : "";
}

export function formatExplanationText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  const paragraphs: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) paragraphs.push(current.trim());
    current = "";
  };
  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (/^(?:\d+[)）.．、]|[①-⑨]|[-・●■◆])\s*/.test(line)) flush();
    if (/^[:：]/.test(line) && current) {
      current += `\n${line.replace(/^[:：]\s*/, "")}`;
      continue;
    }
    current += current ? `${joiner(current, line)}${line}` : line;
  }
  flush();
  return paragraphs.join("\n\n");
}
