"""
GET /api/dashboard  → full dashboard payload for the logged-in user

Returns everything the React Dashboard page needs in one call:
  - career scores (readiness, profile strength, compatibility)
  - best job match
  - recommended roles list
  - skill intelligence (strong / warning / missing)
  - match counts
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.user import User, Candidate, JobMatch, Job
from schemas.schemas import (
    DashboardResponse, DashboardStats,
    RecommendedRole, SkillIntelligenceItem
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    candidate: Candidate = current_user.candidate

    # ── Job matches for this candidate ────────────────────────────────────────
    matches = (
        db.query(JobMatch)
        .filter(JobMatch.candidate_id == candidate.id)
        .order_by(JobMatch.score.desc())
        .all()
    )

    total_matches  = len(matches)
    strong_matches = sum(1 for m in matches if m.level == "strong")

    # Best match details
    best_match_score = 0.0
    best_match_title = "—"
    best_match_level = "—"
    if matches:
        best = matches[0]
        best_match_score = best.score
        best_match_level = best.level or "—"
        job = db.query(Job).filter(Job.id == best.job_id).first()
        best_match_title = job.title if job else "Unknown Role"

    # ── Recommended roles from match data ─────────────────────────────────────
    recommended_roles: list[RecommendedRole] = []
    for m in matches[:5]:
        job = db.query(Job).filter(Job.id == m.job_id).first()
        if job:
            recommended_roles.append(RecommendedRole(title=job.title, score=m.score))

    # ── Skill intelligence ────────────────────────────────────────────────────
    # Derive from the candidate's skills; high proficiency → strong, low → warning
    skills = candidate.skills or []
    skill_intel: list[SkillIntelligenceItem] = []
    for sk in skills[:6]:
        proficiency = sk.get("proficiency", 0) if isinstance(sk, dict) else getattr(sk, "proficiency", 0)
        name = sk.get("name", "") if isinstance(sk, dict) else getattr(sk, "name", "")
        if proficiency >= 4:
            status = "strong"
        elif proficiency >= 2:
            status = "warning"
        else:
            status = "missing"
        skill_intel.append(SkillIntelligenceItem(name=name, status=status))

    # ── Stats ─────────────────────────────────────────────────────────────────
    stats = DashboardStats(
        career_readiness=candidate.career_readiness,
        profile_strength=candidate.profile_strength,
        job_compatibility=candidate.job_compatibility,
        readiness_delta=candidate.readiness_delta,
    )

    return DashboardResponse(
        user_name=candidate.name or current_user.full_name,
        stats=stats,
        recommended_roles=recommended_roles,
        skill_intelligence=skill_intel,
        best_match_score=best_match_score,
        best_match_title=best_match_title,
        best_match_level=best_match_level,
        total_matches=total_matches,
        strong_matches=strong_matches,
    )


@router.post("/scores")
def update_scores(
    career_readiness: float,
    profile_strength: float,
    job_compatibility: float,
    readiness_delta: float = 0.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Called by the resume-analysis microservice after it processes a resume.
    Updates the candidate's computed scores so the dashboard shows fresh data.
    """
    candidate = current_user.candidate
    candidate.career_readiness  = career_readiness
    candidate.profile_strength  = profile_strength
    candidate.job_compatibility = job_compatibility
    candidate.readiness_delta   = readiness_delta
    db.commit()
    return {"message": "Scores updated."}
