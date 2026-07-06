import { describe, expect, it } from "vitest";
import { formatExplanationText, stripDuplicatedChoices } from "./questionText";

const choices = [
  { label: "1", text: "選択肢その1。" },
  { label: "2", text: "選択肢その2。" },
  { label: "3", text: "選択肢その3。" }
];

describe("question text formatting", () => {
  it("removes choices duplicated at the end of the question body", () => {
    const body = "正しいものはどれか。\n1) 選択肢その1。\n2) 選択肢その2。\n3) 選択肢その3。";
    expect(stripDuplicatedChoices(body, choices)).toBe("正しいものはどれか。");
  });

  it("keeps numbered question text when the registered choices do not match", () => {
    const body = "次の手順を確認する。\n1) 前処理を行う。\n2) 結果を確認する。";
    expect(stripDuplicatedChoices(body, choices)).toBe(body);
  });

  it("joins artificial line breaks while keeping explanation sections readable", () => {
    const explanation = "概要を説明する。\n1) 記述。\n: 手術前後の期間（\n周術期\n）に専門的な\n口腔ケア\nを行う。\n\n2) 別の記述。";
    expect(formatExplanationText(explanation)).toBe(
      "概要を説明する。\n\n1) 記述。\n手術前後の期間（周術期）に専門的な口腔ケアを行う。\n\n2) 別の記述。"
    );
  });
});
