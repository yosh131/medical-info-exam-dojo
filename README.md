# 医療情報技師 過去問道場

個人学習専用のローカルファーストPWAです。問題を解き、確信度とA〜Fの誤答原因を記録し、カードと復習キューで弱点を回収します。

## 重要な注意

- 実在する問題・選択肢・解説はIndexedDBにだけ保存されます。
- 実問題のJSON、バックアップ、ローカルDBをGitへ追加しないでください。
- 問題データを公開、共有、再配布しないでください。
- GitHub Pagesに配置されるのはアプリ本体のみです。分析サービスや外部APIは使用しません。

## 開発

Node.js 22 LTSを用意し、次を実行します。

```bash
npm install
npm run dev
```

検証は `npm test`、型チェックは `npm run lint`、静的ビルドは `npm run build` です。

## 問題のインポート

「問題をインポート」画面でJSONファイルを選びます。形式は `question_import_schema.json`、架空データの例は `sample_questions.json` を参照してください。同じ年度・科目・問番号で内容が異なる問題は安全のため上書きされません。

### 既存のkakomon.dbを変換する場合

```bash
python3 scripts/convert_kakomon_db.py imports/db_archive/data/kakomon.db
```

`imports/converted_questions/`に全年度、直近5年度、本文だけで完結する安全なデータ、年度別JSON、変換レポートが作成されます。最初は `latest_5_years_text_only.json` の利用を推奨します。実問題を含むため、このディレクトリはGit管理対象外です。

変換結果はアプリと同じZodスキーマで検証できます。

```bash
npm run validate:questions -- imports/converted_questions/latest_5_years.json
```

## バックアップと復元

設定画面から全データをJSONへ書き出せます。ファイルには問題本文を含むため、個人利用の範囲で安全に保管してください。復元は既存のローカルデータを全置換します。破損・非対応形式は置換前に拒否されます。

## データ削除

設定画面の「全ローカルデータを削除」でIndexedDBを削除します。二段階確認後は取り消せません。

## GitHub Pages

GitHubの Settings → Pages で Source を **GitHub Actions** に設定し、`main`へpushします。ワークフローがリポジトリ名をベースパスとして静的成果物を生成します。カスタムドメインを使う場合は `PAGES_BASE_PATH` の調整が必要です。

## iPhoneへのインストール

SafariでPagesのURLを開き、共有メニューから「ホーム画面に追加」を選択します。iOSはストレージを自動削除する場合があるため、設定画面で永続ストレージを要求し、定期的にバックアップしてください。
