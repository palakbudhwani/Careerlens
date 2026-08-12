"""
GET    /api/candidate          → get current user's candidate profile
PATCH  /api/candidate          → update profile fields
GET    /api/candidate/matches  → all match results for current user
GET    /api/activity           → activity / history log
POST   /api/activity           → log a new action (called after resume scan, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.user import User, Candidate, JobMatch, Job, ActivityLog
from schemas.schemas import (
    CandidateOut, CandidateUpdate,
    JobMatchOut, ActivityLogOut, LogActivityRequest, MessageResponse
)

candidate_router = APIRouter(prefix="/api/candidate", tags=["Candidate"])
activity_router  = APIRouter(prefix="/api/activity",  tags=["Activity"])


# ─── Candidate Profile ────────────────────────────────────────────────────────

@candidate_router.get("", response_model=CandidateOut)
def get_candidate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    candidate = current_user.candidate
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")
    return CandidateOut.model_validate(candidate)


@candidate_router.patch("", response_model=CandidateOut)
def update_candidate(
    body: CandidateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    candidate = current_user.candidate
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert Pydantic sub-models to dicts for JSON storage
        if isinstance(value, list):
            value = [
                v.model_dump() if hasattr(v, "model_dump") else v
                for v in value
            ]
        setattr(candidate, field, value)

    # Auto-update initials if name changed
    if "name" in update_data and candidate.name:
        parts = candidate.name.strip().split()
        candidate.initials = "".join(p[0].upper() for p in parts[:2])

    db.commit()
    db.refresh(candidate)
    return CandidateOut.model_validate(candidate)


# ─── All Matches for Current User ────────────────────────────────────────────

@candidate_router.get("/matches", response_model=list[JobMatchOut])
def get_my_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    candidate = current_user.candidate
    if not candidate:
        return []

    matches = (
        db.query(JobMatch)
        .filter(JobMatch.candidate_id == candidate.id)
        .order_by(JobMatch.score.desc())
        .all()
    )

    result = []
    for m in matches:
        job = db.query(Job).filter(Job.id == m.job_id).first()
        job_out = None
        if job:
            from routers.jobs import _job_to_out
            job_out = _job_to_out(job, m)
        result.append(JobMatchOut(
            id=m.id,
            jobId=m.job_id,
            score=m.score,
            level=m.level,
            summary=m.summary or "",
            breakdown=m.breakdown or [],
            strengths=m.strengths or [],
            gaps=m.gaps or [],
            missingSkills=m.missing_skills or [],
            job=job_out,
        ))
    return result


# ─── Activity Log ─────────────────────────────────────────────────────────────

@activity_router.get("", response_model=list[ActivityLogOut])
def get_activity(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [ActivityLogOut.model_validate(log) for log in logs]


@activity_router.post("", response_model=ActivityLogOut, status_code=201)
def log_activity(
    body: LogActivityRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = ActivityLog(
        user_id=current_user.id,
        action=body.action,
        title=body.title,
        description=body.description,
        score=body.score,
        href=body.href,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return ActivityLogOut.model_validate(log)
