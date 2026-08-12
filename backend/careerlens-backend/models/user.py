"""
SQLAlchemy ORM models for CareerLens.
Tables: users, candidates, jobs, job_matches, dashboard_stats, activity_log
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from core.database import Base


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
#  User  (authentication)
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id             = Column(Integer, primary_key=True, index=True)
    email          = Column(String(255), unique=True, index=True, nullable=False)
    full_name      = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), default=_now)
    updated_at     = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    # relationships
    candidate      = relationship("Candidate", back_populates="user", uselist=False, cascade="all, delete-orphan")
    activity_logs  = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")

# ─────────────────────────────────────────────────────────────────────────────
#  Candidate  (profile data owned by the user)
# ─────────────────────────────────────────────────────────────────────────────

class Candidate(Base):
    __tablename__ = "candidates"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # basic info
    name                 = Column(String(255))
    initials             = Column(String(10))
    title                = Column(String(255))
    location             = Column(String(255))
    years_of_experience  = Column(Integer, default=0)
    headline             = Column(String(512))
    summary              = Column(Text)
    target_role          = Column(String(255))
    open_to_remote       = Column(Boolean, default=True)
    salary_min           = Column(Integer, default=0)
    salary_max           = Column(Integer, default=0)
    preferred_roles      = Column(JSON, default=list)   # list[str]

    # structured data stored as JSON (mirrors frontend types exactly)
    skills               = Column(JSON, default=list)   # list[Skill]
    experience           = Column(JSON, default=list)   # list[Experience]
    education            = Column(JSON, default=list)   # list[Education]

    # dashboard computed scores (set by resume analysis microservice)
    career_readiness     = Column(Float, default=0.0)   # 0-100
    profile_strength     = Column(Float, default=0.0)   # 0-100
    job_compatibility    = Column(Float, default=0.0)   # 0-100
    readiness_delta      = Column(Float, default=0.0)   # week-over-week change

    created_at           = Column(DateTime(timezone=True), default=_now)
    updated_at           = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    # relationships
    user                 = relationship("User", back_populates="candidate")
    matches              = relationship("JobMatch", back_populates="candidate", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
#  Job  (seeded globally, not per-user)
# ─────────────────────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    id               = Column(String(50), primary_key=True)   # e.g. "job-001"
    title            = Column(String(255), nullable=False)
    company          = Column(String(255), nullable=False)
    location         = Column(String(255))
    job_type         = Column(String(50))   # full-time | contract | internship
    work_mode        = Column(String(50))   # remote | hybrid | onsite
    salary_currency  = Column(String(10), default="USD")
    salary_min       = Column(Integer, default=0)
    salary_max       = Column(Integer, default=0)
    posted_days_ago  = Column(Integer, default=0)
    description      = Column(Text)
    responsibilities = Column(JSON, default=list)   # list[str]
    requirements     = Column(JSON, default=list)
    preferred        = Column(JSON, default=list)
    skills           = Column(JSON, default=list)   # list[Skill]
    tags             = Column(JSON, default=list)   # list[str]
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime(timezone=True), default=_now)

    # relationships
    matches          = relationship("JobMatch", back_populates="job", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
#  JobMatch  (per-candidate analysis result for a specific job)
# ─────────────────────────────────────────────────────────────────────────────

class JobMatch(Base):
    __tablename__ = "job_matches"

    id            = Column(Integer, primary_key=True, index=True)
    candidate_id  = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_id        = Column(String(50), ForeignKey("jobs.id"), nullable=False)
    score         = Column(Float, nullable=False)
    level         = Column(String(20))    # strong | moderate | weak
    summary       = Column(Text)
    breakdown     = Column(JSON, default=list)   # list[MatchBreakdown]
    strengths     = Column(JSON, default=list)   # list[str]
    gaps          = Column(JSON, default=list)   # list[str]
    missing_skills = Column(JSON, default=list)  # list[MissingSkill]
    created_at    = Column(DateTime(timezone=True), default=_now)

    # relationships
    candidate     = relationship("Candidate", back_populates="matches")
    job           = relationship("Job", back_populates="matches")


# ─────────────────────────────────────────────────────────────────────────────
#  ActivityLog  (history feed shown on dashboard)
# ─────────────────────────────────────────────────────────────────────────────

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    action      = Column(String(50))    # resume-scan | job-match | skill-gap | view …
    title       = Column(String(255))
    description = Column(String(512))
    score       = Column(Float, nullable=True)
    href        = Column(String(512), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_now)

    # relationships
    user        = relationship("User", back_populates="activity_logs")
