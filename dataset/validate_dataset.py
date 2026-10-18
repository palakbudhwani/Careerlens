import csv
from pathlib import Path

path = Path(__file__).with_name("synthetic_resume_job_matching.csv")
required_columns = {
    "case_id", "candidate_id", "job_id", "candidate_skills", "required_skills",
    "matched_required_skills", "missing_required_skills", "required_skill_overlap_pct",
    "synthetic_reference_band", "data_origin"
}

def split_skills(value):
    return [item.strip() for item in value.split(";") if item.strip()]

with path.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    missing_columns = required_columns - set(reader.fieldnames or [])
    assert not missing_columns, f"Missing columns: {sorted(missing_columns)}"
    rows = list(reader)

assert len(rows) == 60, f"Expected 60 rows, got {len(rows)}"
case_ids = [r["case_id"] for r in rows]
assert len(case_ids) == len(set(case_ids)), "Duplicate case_id values"

for row in rows:
    candidate = {s.casefold() for s in split_skills(row["candidate_skills"])}
    required = split_skills(row["required_skills"])
    matched = split_skills(row["matched_required_skills"])
    missing = split_skills(row["missing_required_skills"])
    expected_matched = [s for s in required if s.casefold() in candidate]
    expected_missing = [s for s in required if s.casefold() not in candidate]
    assert matched == expected_matched, f"Mismatch in matched skills for {row['case_id']}"
    assert missing == expected_missing, f"Mismatch in missing skills for {row['case_id']}"
    expected_score = round(100 * len(expected_matched) / len(required), 2)
    assert abs(float(row["required_skill_overlap_pct"]) - expected_score) < 0.011
    assert row["data_origin"] == "synthetic_generated_example_not_real_person_or_application_log"
    assert row["synthetic_reference_band"] == ("high" if expected_score >= 70 else ("medium" if expected_score >= 40 else "low"))

print("VALIDATION PASSED")
print(f"Rows checked: {len(rows)}")
print(f"Unique case IDs: {len(set(case_ids))}")
print(f"Columns checked: {len(rows[0])}")
print("Skill overlap, missing-skill lists, scores, bands, and synthetic-origin flags are consistent.")
