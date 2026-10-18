# Zenodo deposit steps and metadata

## Before publishing

1. Open and review every file. Run `python validate_dataset.py` and compare the output with `VALIDATION_REPORT.txt`.
2. Confirm that the public release is allowed and that the licence is appropriate. This package contains synthetic examples, not real applicant/job data.
3. List as creators only people who actually contributed to or substantively reviewed the dataset and consent to being named. Do not add all four group members automatically unless authorship/contributions are genuine and agreed.
4. Ask the RM guide whether a Zenodo dataset DOI and public record satisfy your specific RM evidence requirement. A DOI is not a contribution certificate.

## Create a Zenodo record

1. Sign in at https://zenodo.org/.
2. Use the **+ / New upload** action.
3. Upload these files: `synthetic_resume_job_matching.csv`, `README.md`, `DATA_DICTIONARY.md`, `validate_dataset.py`, and `VALIDATION_REPORT.txt`. You may also include this instruction file, but it is not necessary.
4. Fill the required metadata. Suggested values are below; adjust to reflect the real depositing authors and actual date.
5. Save draft first and preview. Publish only after all details are accurate and all creators have approved the release.
6. After publication, copy the DOI and public record URL and save screenshots of the record, files, DOI, and validation output.

## Suggested metadata

**Title**<br>
Synthetic Resume–Job Matching Dataset for Skill-Overlap Evaluation

**Upload type / resource type**<br>
Dataset

**Version**<br>
1.0.0

**Description**<br>
This educational dataset contains 60 synthetic candidate–job pairs across six fictional junior-role families and ten fictional candidate skill profiles. It demonstrates a transparent baseline based on exact overlap between explicitly listed candidate skills and required job skills. All profiles and job templates are synthetic; no real applicants, employers, job advertisements, or CareerLens application logs are included. Match scores and low/medium/high reference bands are derived by a deterministic rule and are not human labels or validated hiring judgments. The rows reuse ten candidate profiles and six job templates and must not be treated as independent real-world observations or used for recruitment decisions. The package includes a data dictionary and a Python validation script. Prepared with AI assistance for educational/research-methodology use; the depositor should disclose this assistance in accordance with institutional rules.

**Creators**<br>
Enter the actual contributor(s) only. Use their real names and affiliations only with their consent. Do not invent authorship.

**Keywords**<br>
synthetic data; resume-job matching; skills; skill overlap; recruitment research; dataset documentation; reproducibility

**Language**<br>
English

**License**<br>
CC BY 4.0 only if the depositor has the right to release these materials and any genuine co-creators agree. Check the selected licence in Zenodo before publishing.

**Related identifier**<br>
Optional. Do not add the journal submission as a related publication unless an actual DOI exists and the relationship is appropriate.

## After publishing: evidence

Save:
- the Zenodo record URL and DOI;
- a screenshot of the public record and files list;
- the actual validation output;
- the README and data dictionary;
- any email from the RM guide confirming whether this counts.

Do not claim that Zenodo issued a contribution certificate: it provides a publication record and DOI. Faculty decides whether this evidence fits the syllabus category.

## Official Zenodo help

- Quick start: https://help.zenodo.org/docs/get-started/quickstart/
- Create new upload: https://help.zenodo.org/docs/deposit/create-new-upload/
- Licences and rights: https://help.zenodo.org/docs/deposit/describe-records/licenses/
