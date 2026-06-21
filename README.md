# 医療情報技師 過去問道場

個人学習専用のローカルファーストPWAです。問題を解き、確信度とA〜Fの誤答原因を記録し、カードと復習キューで弱点を回収します。

## 重要な注意

- 実在する問題・選択肢・解説はIndexedDBにだけ保存されます。
- 実問題のZIP、バックアップ、画像、ローカルDBをGitへ追加しないでください。
- 問題データを公開、共有、再配布しないでください。
- GitHub Pagesに配置されるのはアプリ本体のみです。分析サービスや外部APIは使用しません。

## 開発

Node.js 22 LTSを用意し、次を実行します。

```bash
npm install
npm run dev
```

検証は `npm test`、型チェックは `npm run lint`、静的ビルドは `npm run build` です。

## 問題バンドルの作成とインポート

問題・選択肢・表・画像・PDFは、次のZIP形式でまとめて取り込みます。

```text
latest_5_years.zip
├── manifest.json
├── questions.json
└── media/
    └── ...画像・PDF
```

形式は `question_bundle_manifest.schema.json` と `question_import_schema.json` を参照してください。同じ年度・科目・問番号で内容が異なる問題は安全のため上書きされません。

### 既存のkakomon.dbを変換する場合

```bash
python3 scripts/convert_kakomon_db.py imports/db_archive/data/kakomon.db
```

`imports/question_bundles/`に次のファイルが作成されます。

- `latest_5_years.zip`: 最初のインポートに推奨
- `all_questions.zip`: 変換可能な全年度
- `by_year/<年度>.zip`: 年度別
- `conversion_report.json`: 除外問題・不足メディア・配置先

これらは実問題を含むため、ディレクトリ全体がGit管理対象外です。

変換結果はアプリと同じZodスキーマで検証できます。

```bash
npm run validate:bundle -- imports/question_bundles/latest_5_years.zip
```

アプリの「問題をインポート」でZIPを選択すると、問題とメディアの件数、重複、エラー、SHA-256を確認してからIndexedDBへ保存します。

### 画像を後から追加する

`imports/question_bundles/conversion_report.json`の`missingMedia`に、各ファイルの`expectedLocalPath`が記録されます。その場所へ画像またはPDFを置き、変換コマンドを再実行してください。標準配置は次の形式です。

```text
imports/db_archive/data/media/<年度>/<it|med|sys>/q<問番号2桁>/<ファイル名>
```

DBにSHA-256が登録されている場合、一致しないファイルはバンドルへ入れずレポートへ記録します。

## バックアップと復元

設定画面から問題・学習履歴・画像・PDFを単一ZIPへ書き出せます。個人利用の範囲で安全に保管してください。復元は既存のローカルデータを全置換します。破損、参照切れ、SHA-256不一致は置換前に拒否されます。

## データ削除

設定画面の「全ローカルデータを削除」でIndexedDBを削除します。二段階確認後は取り消せません。

## GitHub Pages

GitHubの Settings → Pages で Source を **GitHub Actions** に設定し、`main`へpushします。ワークフローがリポジトリ名をベースパスとして静的成果物を生成します。カスタムドメインを使う場合は `PAGES_BASE_PATH` の調整が必要です。

## iPhoneへのインストール

SafariでPagesのURLを開き、共有メニューから「ホーム画面に追加」を選択します。ZIPをiPhoneの「ファイル」アプリへ保存し、ホーム画面版のアプリ内からインポートしてください。iOSはストレージを自動削除する場合があるため、設定画面で永続ストレージを要求し、定期的に画像込みバックアップZIPを保存してください。
