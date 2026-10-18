# Synthetic Resume–Job Matching Dataset for Skill-Overlap Evaluation

**Resource type:** Synthetic research/educational dataset<br>
**Version:** 1.0.0<br>
**Language:** English<br>
**Status:** Synthetic, rule-derived, not human-validated<br>

## Summary

This release contains 60 synthetic candidate–job pairs across six fictional junior-role families and ten fictional candidate skill profiles. It is designed to demonstrate a transparent baseline for comparing explicitly listed candidate skills with a job template's required skills.

The dataset is inspired by the general research problem of resume–job matching relevant to CareerLens, but **it was not exported from CareerLens**. It contains no CareerLens application logs, real candidate resumes, real job adverts, employer information, or user data. Candidate profiles and job templates are synthetic examples created from fictional templates; skill-overlap scores and labels are deterministically derived.

## Files

- `synthetic_resume_job_matching.csv` — 60 synthetic candidate–job pair rows.
- `DATA_DICTIONARY.md` — field definitions and label meanings.
- `validate_dataset.py` — standard-library validation script.
- `VALIDATION_REPORT.txt` — results of the validation command run on the included CSV.
- `ZENODO_UPLOAD_STEPS.md` — metadata and deposit checklist.

## Method

`required_skill_overlap_pct` equals the number of required skills explicitly present in `candidate_skills`, divided by the number of required skills, multiplied by 100. Preferred skills do not affect this score.

`synthetic_reference_band` follows this deterministic threshold: `high` at 70% or above, `medium` from 40% to below 70%, and `low` below 40%. These labels are rule-generated for demonstration. They are **not human judgements, model predictions, or validated ground truth**.

## Intended uses

- Teaching and demonstrating a transparent lexical-overlap baseline.
- Testing simple data-processing and validation workflows.
- Designing a future human-annotation protocol.
- Reproducible educational examples of dataset documentation.

## Not intended for

- Real recruitment or employment decisions.
- Claims about actual ATS performance.
- Measuring job performance, suitability, fairness, or hiring outcomes.
- Treating rule-derived labels as expert reference labels.

## Limitations

The 60 rows are not 60 independent candidates: they reuse ten synthetic candidate profiles and six fictional job templates. Exact skill overlap cannot capture synonyms, skill proficiency, evidence in projects, recency, context, transferable skills, or fairness. This small dataset has not been assessed by human annotators and has not been validated against actual hiring outcomes.

## Reproducibility

Run from this directory:

```bash
python validate_dataset.py
```

The included validator checks schema, unique case IDs, row count, score range, synthetic-origin flags, and consistency of matched/missing skills and derived score bands.

## Provenance and AI assistance

This package was prepared with AI assistance for a student research-methodology activity. Before publication, the depositor should review the data and documentation, disclose AI assistance as required by their institution, and ensure that all listed creators have genuinely contributed and consent to the release. Do not claim that the data came from real CareerLens users or that the dataset represents an external data collection.

## Licence

Zenodo requires a licence selection for a public deposit. Consider **Creative Commons Attribution 4.0 International (CC BY 4.0)** only if the person publishing has the rights to distribute the package under that licence and any genuine co-creators agree. Otherwise, do not publish publicly until authorship and licensing are resolved. The depositor must make this selection in Zenodo; this README alone does not create a Zenodo record or license assignment.

## Relationship to CareerLens

This is a standalone synthetic dataset related to the broad resume–job matching problem. It is not a software release of CareerLens and does not include or relicense the group's application source code. Use of the CareerLens project name in a college activity report should be described as the motivating context, not as evidence that the dataset was collected by the application.
