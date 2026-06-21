import DOMPurify from "dompurify";
import { describe, expect, it } from "vitest";
import { sanitizeTableHtml } from "./tableSanitizer";

describe("sanitizeTableHtml",()=>{
  it("keeps table cells and removes executable or remote content",()=>{
    const html='<table><tr><td onclick="alert(1)">値<'+'script>alert(2)</'+'script><img src="https://example.invalid/x.png"></td></tr></table>';
    const safe=sanitizeTableHtml(DOMPurify,html);const documentNode=new DOMParser().parseFromString(safe,"text/html");
    expect(documentNode.querySelector("table")?.textContent).toContain("値");expect(documentNode.querySelector("script")).toBeNull();expect(documentNode.querySelector("img")).toBeNull();expect(documentNode.querySelector("td")?.getAttribute("onclick")).toBeNull();
  });
});
