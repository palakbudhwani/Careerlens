"""
GET  /api/jobs            → paginated job list (with optional match scores for current user)
GET  /api/jobs/{id}       → single job detail
POST /api/jobs/{id}/match → save a match result for the current user
GET  /api/jobs/{id}/match → get existing match result for the current user
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.user import User, Job, JobMatch
from schemas.schemas import JobOut, JobMatchOut, SaveMatchRequest, MessageResponse

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


def _job_to_out(job: Job, match: Optional[JobMatch] = None) -> JobOut:
    """Convert ORM Job → Pydantic JobOut, optionally injecting match score."""
    return JobOut(
        id=job.id,
        title=job.title,
        company=job.company,
        location=job.location or "",
        type=job.job_type or "full-time",
        workMode=job.work_mode or "hybrid",
        salaryRange={"currency": job.salary_currency or "USD", "min": job.salary_min, "max": job.salary_max},
        postedDaysAgo=job.posted_days_ago,
        description=job.description or "",
        responsibilities=job.responsibilities or [],
        requirements=job.requirements or [],
        preferred=job.preferred or [],
        skills=job.skills or [],
        tags=job.tags or [],
        matchScore=match.score if match else None,
        matchLevel=match.level if match else None,
    )


# ─── List Jobs ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[JobOut])
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    work_mode: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Job).filter(Job.is_active == True)

    if work_mode:
        query = query.filter(Job.work_mode == work_mode)
    if job_type:
        query = query.filter(Job.job_type == job_type)

    jobs = query.offset(skip).limit(limit).all()

    # Fetch any existing matches for this candidate
    candidate = current_user.candidate
    match_map: dict[str, JobMatch] = {}
    if candidate:
        existing = db.query(JobMatch).filter(
            JobMatch.candidate_id == candidate.id,
            JobMatch.job_id.in_([j.id for j in jobs])
        ).all()
        match_map = {m.job_id: m for m in existing}

    result = [_job_to_out(j, match_map.get(j.id)) for j in jobs]

    if min_score is not None:
        result = [j for j in result if j.matchScore is not None and j.matchScore >= min_score]

    return result


# ─── Single Job ───────────────────────────────────────────────────────────────

@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.is_active == True).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    candidate = current_user.candidate
    match = None
    if candidate:
        match = db.query(JobMatch).filter(
            JobMatch.candidate_id == candidate.id,
            JobMatch.job_id == job_id
        ).first()

    return _job_to_out(job, match)


# ─── Save Match Result ────────────────────────────────────────────────────────

@router.post("/{job_id}/match", response_model=JobMatchOut, status_code=201)
def save_match(
    job_id: str,
    body: SaveMatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Called by the BERT microservice (your partner's code) after it analyses
    resume vs. job. Saves or overwrites the match result in the DB.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    candidate = current_user.candidate
    if not candidate:
        raise HTTPException(status_code=400, detail="No candidate profile found. Upload your resume first.")

    # Upsert: delete old match if it exists
    existing = db.query(JobMatch).filter(
        JobMatch.candidate_id == candidate.id,
        JobMatch.job_id == job_id
    ).first()
    if existing:
        db.delete(existing)
        db.flush()

    match = JobMatch(
        candidate_id=candidate.id,
        job_id=job_id,
        score=body.score,
        level=body.level,
        summary=body.summary,
        breakdown=[b.model_dump() for b in body.breakdown],
        strengths=body.strengths,
        gaps=body.gaps,
        missing_skills=[ms.model_dump() for ms in body.missing_skills],
    )
    db.add(match)

    # Also update candidate's overall job_compatibility to best match score
    best = db.query(JobMatch).filter(
        JobMatch.candidate_id == candidate.id
    ).order_by(JobMatch.score.desc()).first()
    if best is None or body.score > best.score:
        candidate.job_compatibility = body.score

    db.commit()
    db.refresh(match)
    return _build_match_out(match, job)


# ─── Get Match Result ─────────────────────────────────────────────────────────

@router.get("/{job_id}/match", response_model=JobMatchOut)
def get_match(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    candidate = current_user.candidate
    if not candidate:
        raise HTTPException(status_code=404, detail="No candidate profile.")

    match = db.query(JobMatch).filter(
        JobMatch.candidate_id == candidate.id,
        JobMatch.job_id == job_id
    ).first()
    if not match:
        raise HTTPException(status_code=404, detail="No match result found for this job.")

    job = db.query(Job).filter(Job.id == job_id).first()
    return _build_match_out(match, job)


def _build_match_out(match: JobMatch, job: Optional[Job]) -> JobMatchOut:
    return JobMatchOut(
        id=match.id,
        jobId=match.job_id,
        score=match.score,
        level=match.level,
        summary=match.summary or "",
        breakdown=match.breakdown or [],
        strengths=match.strengths or [],
        gaps=match.gaps or [],
        missingSkills=match.missing_skills or [],
        job=_job_to_out(job) if job else None,
    )
