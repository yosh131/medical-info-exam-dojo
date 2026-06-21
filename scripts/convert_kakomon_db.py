#!/usr/bin/env python3
"""Convert the private kakomon SQLite database to the app's JSON import shape.

Generated files contain question content and are written below imports/, which
is excluded by .gitignore.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any


SUBJECTS = {
    "情報処理技術系": "information",
    "医学医療系": "medical",
    "医学・医療系": "medical",
    "医療情報システム系": "system",
}


def clean(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def convert(db_path: Path, output_dir: Path) -> dict[str, Any]:
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise RuntimeError(f"SQLite integrity check failed: {integrity}")

    notes: dict[int, str] = {}
    for row in connection.execute(
        "SELECT question_id, generated_explanation FROM question_study_notes "
        "WHERE status = 'succeeded' ORDER BY updated_at"
    ):
        notes[row["question_id"]] = clean(row["generated_explanation"])

    enrichments: dict[int, str] = {}
    for row in connection.execute(
        "SELECT question_id, generated_explanation FROM question_enrichments "
        "WHERE status = 'succeeded' AND generated_explanation IS NOT NULL ORDER BY updated_at"
    ):
        enrichments[row["question_id"]] = clean(row["generated_explanation"])

    converted: list[dict[str, Any]] = []
    text_only: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    media_warnings: list[dict[str, Any]] = []
    subject_counts: Counter[str] = Counter()

    for question in connection.execute("SELECT * FROM questions ORDER BY year, domain_jp, question_no"):
        subject = SUBJECTS.get(clean(question["domain_jp"]))
        choices = list(connection.execute(
            "SELECT * FROM question_choices WHERE question_id = ? ORDER BY choice_no", (question["id"],)
        ))
        body = clean(question["question_text"])
        correct_labels = [str(row["choice_no"]) for row in choices if row["is_correct"] == 1]
        reasons: list[str] = []
        if not subject:
            reasons.append("unsupported_subject")
        if not body:
            reasons.append("missing_body")
        if len(choices) < 2:
            reasons.append("fewer_than_two_choices")
        if not correct_labels:
            reasons.append("missing_correct_answer")

        metadata = {
            "sourceId": question["id"], "examYear": question["year"],
            "subject": subject or clean(question["domain_jp"]), "questionNo": question["question_no"],
        }
        if reasons:
            excluded.append({**metadata, "reasons": reasons})
            continue

        explanation_parts: list[str] = []
        original_explanation = clean(question["explanation_text"])
        generated_explanation = notes.get(question["id"]) or enrichments.get(question["id"], "")
        if original_explanation:
            explanation_parts.append(original_explanation)
        if generated_explanation and generated_explanation != original_explanation:
            explanation_parts.append("【学習用補足】\n" + generated_explanation)

        item: dict[str, Any] = {
            "examYear": question["year"], "subject": subject, "questionNo": question["question_no"],
            "body": body, "questionType": "multiple_choice" if len(correct_labels) > 1 else "single_choice",
            "choices": [{"label": str(row["choice_no"]), "text": clean(row["choice_text"])} for row in choices],
            "correctAnswer": correct_labels if len(correct_labels) > 1 else correct_labels[0],
            "source": "ユーザー保有SQLite DB", "rightsNote": "個人学習目的・外部共有禁止",
        }
        title = clean(question["title"])
        if title:
            item["topicSummary"] = title
        if explanation_parts:
            item["explanation"] = "\n\n".join(explanation_parts)
        source_url = clean(question["source_url"])
        if source_url:
            item["sourceUrl"] = source_url
        converted.append(item)
        subject_counts[subject] += 1

        media_dependent = bool(question["has_image"] or question["has_table"] or question["has_figure_keyword"])
        if media_dependent:
            media_warnings.append({
                **metadata, "hasImage": bool(question["has_image"]), "hasTable": bool(question["has_table"]),
                "hasFigureKeyword": bool(question["has_figure_keyword"]),
            })
        else:
            text_only.append(item)

    connection.close()
    years = sorted({item["examYear"] for item in converted})
    latest_years = years[-5:]
    write_json(output_dir / "all_questions.json", converted)
    write_json(output_dir / "latest_5_years.json", [item for item in converted if item["examYear"] in latest_years])
    write_json(output_dir / "text_only_questions.json", text_only)
    write_json(output_dir / "latest_5_years_text_only.json", [item for item in text_only if item["examYear"] in latest_years])
    for year in years:
        write_json(output_dir / "by_year" / f"{year}.json", [item for item in converted if item["examYear"] == year])

    report = {
        "sourceDatabase": str(db_path), "sqliteIntegrity": integrity,
        "convertedQuestions": len(converted), "excludedQuestions": len(excluded),
        "latestFiveYears": latest_years,
        "latestFiveYearQuestions": sum(item["examYear"] in latest_years for item in converted),
        "textOnlyQuestions": len(text_only),
        "latestFiveYearTextOnlyQuestions": sum(item["examYear"] in latest_years for item in text_only),
        "countsBySubject": dict(sorted(subject_counts.items())),
        "countsByYear": dict(sorted(Counter(str(item["examYear"]) for item in converted).items())),
        "mediaDependentQuestions": len(media_warnings), "excluded": excluded, "mediaWarnings": media_warnings,
    }
    write_json(output_dir / "conversion_report.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("db", type=Path, help="Path to kakomon.db")
    parser.add_argument("--output", type=Path, default=Path("imports/converted_questions"))
    args = parser.parse_args()
    report = convert(args.db, args.output)
    print(f"Converted: {report['convertedQuestions']} questions")
    print(f"Excluded: {report['excludedQuestions']} questions")
    print(f"Latest five years: {report['latestFiveYears']} ({report['latestFiveYearQuestions']} questions)")
    print(f"Media/table review recommended: {report['mediaDependentQuestions']} questions")
    print(f"Safe text-only set: {report['textOnlyQuestions']} questions")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
