import type { Choice, Question } from "./types";

export function createConsultationTemplate(question: Question, choices: Choice[], userAnswer: string | string[]) {
  return `医療情報技師試験の勉強中です。
以下の問題について、正解に至る考え方を説明してください。

制約:
- 問題文をそのまま再掲しない
- 選択肢ごとに、なぜ正しい/誤りかを説明
- 関連する医療制度・標準規格・業務フローを補足
- 最後に暗記カード候補を3つ作る
- 不確かな制度情報は断言せず、確認すべき資料名を示す

科目: ${question.subject}
年度: ${question.examYear}
問番号: ${question.questionNo}
自分の解答: ${Array.isArray(userAnswer) ? userAnswer.join(", ") : userAnswer}
正解: ${Array.isArray(question.correctAnswer) ? question.correctAnswer.join(", ") : question.correctAnswer}
問題文: ${question.body}
選択肢:
${choices.map((choice) => `${choice.label}. ${choice.text}`).join("\n")}
既存解説: ${question.explanation ?? "なし"}`;
}
