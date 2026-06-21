#!/usr/bin/env python3
"""Build private, media-capable question ZIP bundles from kakomon.db."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import sqlite3
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

SUBJECTS = {"情報処理技術系": "information", "医学医療系": "medical", "医学・医療系": "medical", "医療情報システム系": "system"}
ALLOWED_MEDIA = {"image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"}
TABLE_RE = re.compile(r"<table\b[^>]*>.*?</table\s*>", re.IGNORECASE | re.DOTALL)


def clean(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def extract_tables(value: Any) -> str:
    return "\n".join(TABLE_RE.findall(clean(value)))


def resolve_media(db_path: Path, local_path: str) -> Path | None:
    parts = PurePosixPath(local_path.replace("\\", "/")).parts
    if "media" in parts:
        candidate = db_path.parent.joinpath(*parts[parts.index("media"):])
        if candidate.is_file():
            return candidate
    candidate = db_path.parent / local_path
    return candidate if candidate.is_file() else None


def write_bundle(path: Path, questions: list[dict[str, Any]], media_sources: dict[str, Path]) -> None:
    media_paths = {media["path"] for question in questions for media in question["media"]}
    manifest = {
        "format": "medical-info-exam-question-bundle", "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "questionsFile": "questions.json", "questionCount": len(questions), "mediaCount": len(media_paths),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        archive.writestr("questions.json", json.dumps(questions, ensure_ascii=False, separators=(",", ":")))
        for media_path in sorted(media_paths):
            archive.write(media_sources[media_path], media_path)


def convert(db_path: Path, output_dir: Path) -> dict[str, Any]:
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise RuntimeError(f"SQLite integrity check failed: {integrity}")
    notes = {row["question_id"]: clean(row["generated_explanation"]) for row in connection.execute(
        "SELECT question_id,generated_explanation FROM question_study_notes WHERE status='succeeded' ORDER BY updated_at")}
    enrichments = {row["question_id"]: clean(row["generated_explanation"]) for row in connection.execute(
        "SELECT question_id,generated_explanation FROM question_enrichments WHERE status='succeeded' AND generated_explanation IS NOT NULL ORDER BY updated_at")}

    converted: list[dict[str, Any]] = []; excluded: list[dict[str, Any]] = []; media_warnings: list[dict[str, Any]] = []
    media_sources: dict[str, Path] = {}; subject_counts: Counter[str] = Counter(); available_media = 0; missing_media = 0
    for question in connection.execute("SELECT * FROM questions ORDER BY year,domain_jp,question_no"):
        subject = SUBJECTS.get(clean(question["domain_jp"])); choices = list(connection.execute(
            "SELECT * FROM question_choices WHERE question_id=? ORDER BY choice_no", (question["id"],)))
        body = clean(question["question_text"]); correct = [str(row["choice_no"]) for row in choices if row["is_correct"] == 1]
        reasons = (["unsupported_subject"] if not subject else []) + (["missing_body"] if not body else []) + (["fewer_than_two_choices"] if len(choices) < 2 else []) + (["missing_correct_answer"] if not correct else [])
        metadata = {"sourceId": question["id"], "examYear": question["year"], "subject": subject or clean(question["domain_jp"]), "questionNo": question["question_no"]}
        if reasons:
            excluded.append({**metadata, "reasons": reasons}); continue

        media_items: list[dict[str, Any]] = []
        for media in connection.execute("SELECT * FROM question_media WHERE question_id=? ORDER BY media_role,media_order,id", (question["id"],)):
            local_path = clean(media["local_path"]); source_file = resolve_media(db_path, local_path) if local_path else None
            mime = clean(media["content_type"]) or (mimetypes.guess_type(local_path)[0] or "")
            if not source_file or mime not in ALLOWED_MEDIA:
                missing_media += 1; continue
            file_hash = hashlib.sha256(source_file.read_bytes()).hexdigest(); expected = clean(media["file_sha256"]).lower()
            if expected and expected != file_hash:
                media_warnings.append({**metadata, "mediaId": media["id"], "reason": "sha256_mismatch"}); missing_media += 1; continue
            filename = re.sub(r"[^\w.-]+", "_", source_file.name, flags=re.UNICODE)
            bundle_path = f"media/{question['year']}/{subject}/q{question['question_no']:03d}/{media['id']}_{filename}"
            descriptor = {"id": f"source-media-{media['id']}", "role": media["media_role"], "order": media["media_order"],
                "path": bundle_path, "fileName": source_file.name, "mimeType": mime, "sha256": file_hash}
            media_items.append(descriptor); media_sources[bundle_path] = source_file; available_media += 1

        explanation_parts = [part for part in [clean(question["explanation_text"])] if part]
        generated = notes.get(question["id"]) or enrichments.get(question["id"], "")
        if generated and generated not in explanation_parts:
            explanation_parts.append("【学習用補足】\n" + generated)
        item: dict[str, Any] = {"examYear": question["year"], "subject": subject, "questionNo": question["question_no"], "body": body,
            "questionType": "multiple_choice" if len(correct) > 1 else "single_choice",
            "choices": [{"label": str(row["choice_no"]), "text": clean(row["choice_text"])} for row in choices],
            "correctAnswer": correct if len(correct) > 1 else correct[0], "media": media_items,
            "source": "ユーザー保有SQLite DB", "rightsNote": "個人学習目的・外部共有禁止"}
        for field, value in [("topicSummary", clean(question["title"])), ("explanation", "\n\n".join(explanation_parts)),
            ("bodyTableHtml", extract_tables(question["question_html"])), ("explanationTableHtml", extract_tables(question["explanation_html"])),
            ("sourceUrl", clean(question["source_url"]))]:
            if value: item[field] = value
        converted.append(item); subject_counts[subject] += 1
        if question["has_image"] or question["has_table"] or question["has_figure_keyword"]:
            media_warnings.append({**metadata, "hasImage": bool(question["has_image"]), "hasTable": bool(question["has_table"]), "hasFigureKeyword": bool(question["has_figure_keyword"]), "reason": "review_rendering"})
    connection.close()

    years = sorted({item["examYear"] for item in converted}); latest = years[-5:]
    write_bundle(output_dir / "all_questions.zip", converted, media_sources)
    write_bundle(output_dir / "latest_5_years.zip", [item for item in converted if item["examYear"] in latest], media_sources)
    for year in years: write_bundle(output_dir / "by_year" / f"{year}.zip", [item for item in converted if item["examYear"] == year], media_sources)
    report = {"sourceDatabase": str(db_path), "sqliteIntegrity": integrity, "convertedQuestions": len(converted), "excludedQuestions": len(excluded),
        "latestFiveYears": latest, "latestFiveYearQuestions": sum(item["examYear"] in latest for item in converted),
        "countsBySubject": dict(sorted(subject_counts.items())), "countsByYear": dict(sorted(Counter(str(item["examYear"]) for item in converted).items())),
        "availableMediaFiles": available_media, "missingMediaReferences": missing_media, "reviewWarnings": len(media_warnings),
        "excluded": excluded, "mediaWarnings": media_warnings}
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "conversion_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser=argparse.ArgumentParser();parser.add_argument("db",type=Path);parser.add_argument("--output",type=Path,default=Path("imports/question_bundles"));args=parser.parse_args()
    report=convert(args.db,args.output)
    print(f"Converted: {report['convertedQuestions']} questions; excluded: {report['excludedQuestions']}")
    print(f"Latest five years: {report['latestFiveYearQuestions']} questions")
    print(f"Bundled media: {report['availableMediaFiles']}; missing media references: {report['missingMediaReferences']}")
    print(f"Output: {args.output}")


if __name__ == "__main__": main()
