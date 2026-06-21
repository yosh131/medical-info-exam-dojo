# 医療情報技師試験 過去問学習PWA 要件定義・実装依頼書

## 0. 依頼概要

医療情報技師試験に向けた個人専用の過去問学習Webアプリを実装したい。

ユーザーは既に過去問データをDBとして保有している。  
本アプリでは、その過去問DBを取り込み、スマホから過去問演習、正誤記録、誤答分類、カード作成、復習スケジューリング、弱点分析を行えるようにする。

重要な前提として、このアプリは**本人のみが使う個人学習用アプリ**であり、過去問データの公開・共有・再配布は一切行わない。  
著作権・セキュリティ上のリスクを抑えるため、問題文・選択肢・解説などの著作物性の高いデータは原則としてローカルDBに保持し、クラウドに置く場合は強い制限を設ける。

---

## 1. 目的

### 1.1 学習上の目的

以下の学習サイクルをスマホで高速に回せるようにする。

1. 過去問を解く
2. 自分の解答と確信度を記録する
3. 採点する
4. 不正解または低確信度の問題をA〜Fで分類する
5. 必要に応じて暗記カードを作る
6. 復習予定に入れる
7. 科目別・年度別・誤答原因別に弱点を可視化する

### 1.2 試験対策上の重点

対象試験は医療情報技師能力検定試験。

学習方針は以下。

- 過去問5年分を2.5〜3周する
- 教科書は辞書として使う
- 正解でも迷った問題は復習対象にする
- 情報系バックグラウンドがあるため、情報処理技術系の比重はやや低め
- 医療情報システム系、医学・医療系を重点的に復習する

---

## 2. 想定利用者

- 利用者は1名
- スマホ中心で利用
- PCでも利用できるとよい
- 公開サービスではなく、自分専用ツール
- 過去問データはユーザーが既に保有している
- ユーザーは技術者であり、JSON/CSVインポートやローカル環境構築は許容できる

---

## 3. 推奨アーキテクチャ

### 3.1 第一候補

ローカルファーストPWA。

```text
Next.js / React PWA
  ├─ IndexedDB または SQLite WASM
  │   ├─ 過去問本文
  │   ├─ 選択肢
  │   ├─ 正解
  │   ├─ 既存解説
  │   ├─ 解答履歴
  │   ├─ 誤答分類
  │   └─ カード
  └─ 任意: エクスポート/インポートによるバックアップ
```

### 3.2 クラウド同期を入れる場合

問題文・選択肢・既存解説はローカルに残し、クラウドには学習ログのみ保存する。

```text
Local
  - 問題文
  - 選択肢
  - 正解
  - 解説
  - 出典情報

Cloud
  - 解答履歴
  - A〜F分類
  - 自作カード
  - 復習スケジュール
  - 進捗サマリ
```

初期MVPではクラウド同期なしでよい。

---

## 4. 技術スタック案

### 4.1 推奨

- Frontend: Next.js + React + TypeScript
- Styling: Tailwind CSS
- PWA: next-pwa または Vite PWA
- Local DB: IndexedDB
  - ラッパー: Dexie.js
- State Management: Zustand または React Context
- Validation: Zod
- Date Utility: date-fns
- Chart: Recharts
- Test: Vitest + React Testing Library
- Lint/Format: ESLint + Prettier

### 4.2 SQLiteを使う場合

- sql.js または wa-sqlite
- 既存DBがSQLiteなら、SQLite WASMのほうが移行しやすい可能性がある
- ただしPWAでの取り回しはDexie.jsのほうが簡単

---

## 5. 権利・セキュリティ方針

### 5.1 必須方針

- アプリは個人利用専用
- 問題文・選択肢・解説を外部公開しない
- 共有URL機能を作らない
- ランキングやSNS投稿機能を作らない
- 問題文のスクレイピング機能は作らない
- 問題文をURL、ログ、analytics、エラー監視に含めない
- AI APIを使う場合、送信前に明示的な確認を出す
- AIへの問い合わせ内容を自前DBに全文保存しない

### 5.2 保存データの扱い

問題文・選択肢・既存解説はローカルDBに保存する。  
クラウド利用を将来追加する場合でも、本文データは原則クラウドに保存しない。

### 5.3 禁止する実装

以下は実装しない。

- 問題文の公開共有
- カードの公開共有
- 他ユーザー招待
- 過去問DBの外部配布
- 問題文全文を含むエクスポートを無制限に生成する機能
- 問題文を含むURLクエリ
- 問題文を含むアクセスログ

---

## 6. 誤答分類仕様

不正解または低確信度の問題に対して、以下のA〜F分類を付与する。

| 分類 | 意味 | アプリ上の扱い |
|---|---|---|
| A | 用語を知らない | 用語カードを作る |
| B | 制度・法令を知らない | 制度カード・比較カードを作る |
| C | 医療業務フローが見えていない | 流れ・業務フローのメモを作る |
| D | 標準規格・システム構成が曖昧 | 比較カード・関係整理カードを作る |
| E | 計算・統計・DB・NWの穴 | 類題演習・計算手順カードを作る |
| F | 問題文の読み落とし | 読み落としログとして記録する |

仕様:

- primary_reason は1つ必須
- secondary_reasons は複数選択可
- 正解でも confidence が low または medium の場合は分類対象にできる
- Fは知識不足ではなく読解・注意ミスとして別集計する

---

## 7. 機能要件

## 7.1 データインポート

### 概要

ユーザーが既に持っている過去問DBをJSONまたはCSVでインポートできるようにする。

### 必須

- JSONインポート
- 年度、科目、問番号の重複チェック
- 選択肢数チェック
- 正解ラベルの妥当性チェック
- 問題文の空欄チェック
- content_hash による重複検出
- インポート結果のサマリ表示

### 任意

- CSVインポート
- SQLiteファイルインポート
- 差分更新
- インポート前プレビュー

### content_hash

以下を連結してSHA-256を計算する。

```text
body + choices.text + correct_answer
```

---

## 7.2 問題一覧画面

### 表示

- 年度
- 科目
- 問番号
- 解答状態
- 正誤
- 確信度
- 復習対象フラグ
- 最終解答日
- A〜F分類

### フィルタ

- 年度
- 科目
- 未解答
- 誤答
- 低確信度
- 復習期限到来
- A〜F分類
- 2回以上間違えた問題

---

## 7.3 演習画面

### 表示

- 年度
- 科目
- 問番号
- 問題文
- 選択肢
- 解答ボタン
- 確信度ボタン
- 採点ボタン
- 解説表示
- 次の問題ボタン

### 操作フロー

```text
問題を読む
  ↓
選択肢を選ぶ
  ↓
確信度を選ぶ
  ↓
採点
  ↓
正誤表示
  ↓
不正解または低確信度ならA〜F分類
  ↓
必要ならカード作成
  ↓
次の問題
```

### 確信度

- high: 自信あり
- medium: 迷った
- low: ほぼ勘

### 採点後表示

- 正解/不正解
- 正解選択肢
- 既存解説
- 自分の解答
- A〜F分類入力
- カード作成ボタン
- ChatGPT相談テンプレ作成ボタン

---

## 7.4 A〜F分類入力

### 必須条件

- 不正解時は primary_reason 必須
- confidence が low の場合は正解でも分類推奨
- F選択時は読み落としパターンも選べる

### Fのサブ分類

- 誤っているものを選ぶ問題の読み落とし
- 正しいものを選ぶ問題の読み落とし
- 最も適切という条件の見落とし
- 主体の取り違え
- 時点・条件の見落とし
- 数値・単位の読み落とし
- その他

---

## 7.5 カード作成

### カード種別

- 用語カード
- 判断カード
- 比較カード
- 業務フローカード
- 計算手順カード
- 読み落とし注意カード

### カード作成方針

問題文を丸ごとカードにしない。  
問題から抽出した論点を、自分の言葉でカード化する。

### カード項目

- 表面
- 裏面
- 科目
- タグ
- 元問題ID
- カード種別
- 次回復習日
- 復習間隔
- 正解回数
- 失敗回数

---

## 7.6 復習スケジューラ

短期試験対策向けの簡易スケジューラでよい。

### 初期ルール

| 状態 | 次回復習 |
|---|---|
| 初回ミス | 翌日 |
| 次に正解 | 3日後 |
| 連続2回正解 | 7日後 |
| 連続3回正解 | 14日後 |
| 間違えた | 翌日に戻す |
| 試験前週 | 全重要カードを再表示 |

### 対象

- 誤答問題
- 低確信度正解問題
- 作成カード
- 2回以上間違えた問題

---

## 7.7 ダッシュボード

### 表示指標

- 試験日までの残日数
- 今日の復習件数
- 過去問5年分の進捗率
- 科目別正答率
- 年度別正答率
- A〜F分類別の誤答件数
- 低確信度正解数
- 2回以上間違えた問題数
- 医療情報システム系の弱点ランキング

### 科目の優先表示

医療情報システム系、医学・医療系を上位に表示する。  
情報処理技術系は維持枠として扱う。

---

## 7.8 ChatGPT相談テンプレ作成

### MVP方針

API連携ではなく、まずはクリップボードコピー機能にする。

### テンプレート

```text
医療情報技師試験の勉強中です。
以下の問題について、正解に至る考え方を説明してください。

制約:
- 問題文をそのまま再掲しない
- 選択肢ごとに、なぜ正しい/誤りかを説明
- 関連する医療制度・標準規格・業務フローを補足
- 最後に暗記カード候補を3つ作る
- 不確かな制度情報は断言せず、確認すべき資料名を示す

科目:
年度:
問番号:
自分の解答:
正解:
問題文:
選択肢:
既存解説:
```

### 注意

- クリップボードコピー前に確認ダイアログを表示する
- 問題文を外部サービスへ送る判断はユーザーが行う
- API連携はMVPでは実装しない

---

## 8. データモデル案

## 8.1 Question

```ts
type Subject = "information" | "medical" | "system";
type QuestionType = "single_choice" | "multiple_choice" | "true_false_combination" | "other";

type Question = {
  id: string;
  examYear: number;
  subject: Subject;
  questionNo: number;
  body: string;
  questionType: QuestionType;
  correctAnswer: string | string[];
  explanation?: string;
  topicSummary?: string;
  source?: string;
  sourceUrl?: string;
  rightsNote?: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};
```

## 8.2 Choice

```ts
type Choice = {
  id: string;
  questionId: string;
  label: string;
  text: string;
  isCorrect?: boolean;
};
```

## 8.3 Attempt

```ts
type Confidence = "high" | "medium" | "low";

type Attempt = {
  id: string;
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  confidence: Confidence;
  elapsedSec?: number;
  attemptedAt: string;
};
```

## 8.4 ErrorAnalysis

```ts
type ErrorReason = "A" | "B" | "C" | "D" | "E" | "F";

type ReadingMistakeType =
  | "missed_negative"
  | "missed_positive"
  | "missed_best_answer"
  | "wrong_subject"
  | "missed_condition"
  | "missed_number_or_unit"
  | "other";

type ErrorAnalysis = {
  id: string;
  attemptId: string;
  questionId: string;
  primaryReason: ErrorReason;
  secondaryReasons: ErrorReason[];
  readingMistakeType?: ReadingMistakeType;
  note?: string;
  createdAt: string;
};
```

## 8.5 Card

```ts
type CardType =
  | "term"
  | "judgement"
  | "comparison"
  | "workflow"
  | "calculation"
  | "reading_mistake";

type Card = {
  id: string;
  questionId?: string;
  subject: Subject;
  cardType: CardType;
  front: string;
  back: string;
  tags: string[];
  dueAt: string;
  intervalDays: number;
  reviewCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
};
```

## 8.6 ReviewLog

```ts
type ReviewResult = "good" | "hard" | "again";

type ReviewLog = {
  id: string;
  cardId?: string;
  questionId?: string;
  result: ReviewResult;
  reviewedAt: string;
};
```

---

## 9. JSONインポート形式

別ファイル `question_import_schema.json` を参照。

最小例:

```json
[
  {
    "examYear": 2025,
    "subject": "system",
    "questionNo": 1,
    "body": "問題文...",
    "questionType": "single_choice",
    "choices": [
      {"label": "1", "text": "選択肢1"},
      {"label": "2", "text": "選択肢2"},
      {"label": "3", "text": "選択肢3"},
      {"label": "4", "text": "選択肢4"},
      {"label": "5", "text": "選択肢5"}
    ],
    "correctAnswer": "3",
    "explanation": "解説...",
    "source": "ユーザー保有DB",
    "rightsNote": "個人学習目的"
  }
]
```

---

## 10. 画面一覧

## 10.1 Home

- 試験日までの残日数
- 今日の演習
- 今日の復習
- 未完了の誤答分類
- 直近の正答率
- 弱点上位

## 10.2 Import

- JSONファイル選択
- バリデーション結果
- インポート件数
- スキップ件数
- 重複件数
- エラー詳細

## 10.3 QuestionList

- 問題一覧
- フィルタ
- ソート
- 年度・科目別選択

## 10.4 Practice

- 問題表示
- 選択肢
- 解答
- 確信度
- 採点
- 解説
- A〜F分類
- カード作成
- 次へ

## 10.5 Review

- 今日復習するカード
- 今日復習する問題
- 復習結果入力
- 次回復習日更新

## 10.6 Cards

- カード一覧
- 検索
- タグフィルタ
- 科目フィルタ
- A〜F由来フィルタ

## 10.7 Dashboard

- 正答率グラフ
- A〜F誤答件数
- 科目別弱点
- 年度別進捗

## 10.8 Settings

- 試験日
- インポート/エクスポート
- データ削除
- バックアップ
- AI連携設定
- 権利・利用上の注意表示

---

## 11. URL設計

問題文をURLに含めない。

```text
/
/import
/questions
/questions/:id
/practice
/review
/cards
/dashboard
/settings
```

年度・科目・問番号で開く場合:

```text
/practice?year=2025&subject=system&questionNo=12
```

URLに問題文や選択肢本文は含めない。

---

## 12. MVPスコープ

最初に実装する範囲。

1. PWA基本構成
2. ローカルDB
3. JSONインポート
4. 問題一覧
5. 演習画面
6. 採点
7. 確信度記録
8. A〜F分類
9. カード作成
10. 復習キュー
11. ダッシュボード簡易版
12. エクスポート/バックアップ
13. ChatGPT相談テンプレコピー

MVPでは実装しない。

- AI API連携
- クラウド同期
- OCR
- スクレイピング
- 共有機能
- 複数ユーザー対応
- ランキング
- SNS投稿
- 高度な spaced repetition

---

## 13. 実装タスク分解案

### Phase 1: 基盤

- Next.js + TypeScript セットアップ
- Tailwind CSS導入
- PWA設定
- Dexie.js導入
- 基本レイアウト作成
- ルーティング作成

### Phase 2: DB

- Dexieスキーマ定義
- questions / choices / attempts / errorAnalyses / cards / reviewLogs テーブル作成
- Zodによるインポートデータ検証
- content_hash生成
- エクスポート/インポート基盤

### Phase 3: インポート画面

- JSONファイル選択
- バリデーション
- プレビュー
- インポート実行
- 重複スキップ
- エラー表示

### Phase 4: 演習

- 問題一覧
- 問題詳細
- 解答UI
- 確信度UI
- 採点処理
- attempt保存
- 解説表示

### Phase 5: 誤答分類

- A〜F選択UI
- secondary reason対応
- Fのサブ分類
- 分類未完了問題の表示

### Phase 6: カード

- カード作成フォーム
- 問題からカード候補入力
- カード一覧
- カード編集
- カード削除

### Phase 7: 復習

- dueAtベースの復習キュー
- Review結果入力
- 次回復習日更新ロジック
- 試験前週の重要カード再表示

### Phase 8: ダッシュボード

- 科目別正答率
- 年度別進捗
- A〜F別誤答件数
- 2回以上間違えた問題
- 今日の復習件数

### Phase 9: ChatGPT相談テンプレ

- 問題情報からテンプレ生成
- クリップボードコピー
- 外部送信に関する確認ダイアログ
- 問題文をログに出さない

---

## 14. 受け入れ条件

### インポート

- 正常なJSONを読み込める
- 不正なJSONはエラー表示される
- 年度・科目・問番号の重複を検出できる
- content_hash重複を検出できる

### 演習

- 問題文と選択肢が表示される
- 解答を選べる
- 確信度を選べる
- 採点できる
- 解答履歴が保存される
- 解説が表示される

### 誤答分類

- 不正解時にA〜Fを保存できる
- 正解でも低確信度なら復習対象にできる
- Fの読み落とし種別を保存できる

### カード

- カードを作成できる
- カードを編集できる
- カードを削除できる
- 次回復習日が設定される

### 復習

- 今日の復習対象が表示される
- 復習結果に応じてdueAtが更新される
- 間違えたカードは翌日に戻る

### ダッシュボード

- 科目別正答率が表示される
- A〜F別誤答件数が表示される
- 今日の復習件数が表示される
- 2回以上間違えた問題が表示される

### セキュリティ・権利

- 共有URLが存在しない
- 問題文がURLに含まれない
- console.logに問題文を出さない
- エクスポート前に確認を出す
- ChatGPTテンプレコピー前に確認を出す

---

## 15. UI方針

- スマホファースト
- 片手操作しやすい
- 1問の記録を30秒以内に完了できる
- 採点後にすぐA〜F分類できる
- チェックボックス、ボタン、カードUI中心
- 長文入力は最小化
- ダークモード対応は任意

---

## 16. 優先度

### Must

- JSONインポート
- 問題演習
- 採点
- 解答履歴
- A〜F分類
- カード作成
- 復習キュー
- 簡易ダッシュボード

### Should

- エクスポート/バックアップ
- ChatGPT相談テンプレコピー
- Fの読み落とし詳細分類
- 検索・フィルタ
- スマホPWA対応

### Could

- CSVインポート
- SQLiteインポート
- グラフ改善
- タグ推薦
- カード自動生成補助
- クラウド同期

### Won't for MVP

- AI API連携
- OCR
- スクレイピング
- 共有機能
- 複数ユーザー対応

---

## 17. 実装時の注意

- 問題文・選択肢・解説を開発ログに出さない
- サンプルデータには架空問題を使う
- テストにも実在過去問を含めない
- GitHubに実問題データをコミットしない
- `.gitignore` にローカルDBやインポートデータを含める
- seedデータは架空のものだけにする
- Vercelなどにデプロイする場合も、問題DBは含めない

---

## 18. 期待する成果物

- Next.js/TypeScriptのPWAアプリ
- ローカルDBスキーマ
- JSONインポート機能
- 問題演習画面
- 誤答分類画面
- カード作成・復習画面
- ダッシュボード
- README
- サンプルJSON
- 環境構築手順
- 簡単なテスト

---

## 19. READMEに含めるべき内容

- アプリの目的
- 個人学習専用であること
- 過去問データを公開・共有しないこと
- インストール方法
- 開発サーバー起動方法
- JSONインポート形式
- バックアップ方法
- データ削除方法
- 注意事項

---

## 20. 最終判断

このアプリは、公開Webサービスではなく、個人専用の学習支援PWAとして実装する。

設計上の中核は以下。

```text
既存過去問DBをローカルに取り込む
  ↓
スマホで解く
  ↓
正誤・確信度を記録
  ↓
A〜Fで誤答分類
  ↓
カード化
  ↓
復習キューに入れる
  ↓
弱点を可視化する
```

問題文データを活用しつつ、外部公開・共有・再配布を避ける。  
MVPではAI API連携は行わず、必要時にChatGPT相談テンプレをコピーするところまでに留める。
