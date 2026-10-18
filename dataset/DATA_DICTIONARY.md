# Data Dictionary

| Field | Meaning |
|---|---|
| `case_id` | Unique row identifier for each candidate–job pair. |
| `candidate_id` | Synthetic candidate profile identifier; repeated across jobs. |
| `job_id` | Synthetic job-template identifier. |
| `job_family` | Broad fictional role family. |
| `role_title` | Fictional junior role title. |
| `candidate_profile_summary` | Short synthetic profile narrative; no real person is represented. |
| `candidate_skills` | Explicit skills associated with the synthetic profile, separated by semicolons. |
| `required_skills` | Required skills in the synthetic job template. |
| `preferred_skills` | Preferred skills that do not affect the overlap score. |
| `matched_required_skills` | Required skills also listed for the candidate. |
| `missing_required_skills` | Required skills absent from the candidate's explicit skill list. |
| `matched_preferred_skills` | Preferred skills also listed for the candidate. |
| `required_skill_overlap_pct` | `100 × number of matched required skills / number of required skills`. |
| `synthetic_reference_band` | Rule-derived band: high ≥70%; medium ≥40% and <70%; low <40%. |
| `label_generation_rule` | Text description of the deterministic label rule. |
| `data_origin` | Explicit indicator that examples are synthetic. |
| `variation_type` | Scenario family; currently a baseline overlap dataset. |

## Annotation status

There are no human labels in this release. The field `synthetic_reference_band` is generated using the rule above and must not be represented as a human assessment.
