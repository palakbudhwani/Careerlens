"""
Pydantic v2 schemas — field names match the TypeScript types in the frontend
src/types/index.ts so responses slot straight into the React data layer.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Shared primitives (mirror TS types)
# ─────────────────────────────────────────────────────────────────────────────


SkillCategory = Literal["technical", "soft", "tool"]

Proficiency = Literal[1, 2, 3, 4, 5]

MatchLevel = Literal["strong", "moderate", "weak"]

MatchCategory = Literal["hard", "soft", "experience", "education"]

Importance = Literal["critical", "important", "nice-to-have"]

JobType = Literal["full-time", "contract", "internship"]

WorkMode = Literal["remote", "hybrid", "onsite"]


class Skill(BaseModel):
    id: str
    name: str
    category: SkillCategory
    proficiency: Proficiency
    years: Optional[int] = None


class Experience(BaseModel):
    role: str
    company: str
    location: str
    start: str
    end: Optional[str] = None
    highlights: list[str] = []


class Education(BaseModel):
    degree: str
    institution: str
    year: str
    field: Optional[str] = None


class SalaryRange(BaseModel):
    min: int
    max: int


# ─────────────────────────────────────────────────────────────────────────────
# Candidate
# ─────────────────────────────────────────────────────────────────────────────


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    location: Optional[str] = None
    years_of_experience: Optional[int] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    target_role: Optional[str] = None
    open_to_remote: Optional[bool] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    preferred_roles: Optional[list[str]] = None
    skills: Optional[list[Skill]] = None
    experience: Optional[list[Experience]] = None
    education: Optional[list[Education]] = None


class CandidateOut(BaseModel):
    id: int
    name: Optional[str]
    initials: Optional[str]
    title: Optional[str]
    location: Optional[str]
    years_of_experience: int
    headline: Optional[str]
    summary: Optional[str]
    target_role: Optional[str]
    open_to_remote: bool
    salary_min: int
    salary_max: int
    preferred_roles: list[str]
    skills: list[Skill]
    experience: list[Experience]
    education: list[Education]
    career_readiness: float
    profile_strength: float
    job_compatibility: float
    readiness_delta: float

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────


class DashboardStats(BaseModel):
    career_readiness: float
    profile_strength: float
    job_compatibility: float
    readiness_delta: float


class RecommendedRole(BaseModel):
    title: str
    score: float


class SkillIntelligenceItem(BaseModel):
    name: str
    status: Literal["strong", "warning", "missing"]


class DashboardResponse(BaseModel):
    user_name: str
    stats: DashboardStats
    recommended_roles: list[RecommendedRole]
    skill_intelligence: list[SkillIntelligenceItem]
    best_match_score: float
    best_match_title: str
    best_match_level: str
    total_matches: int
    strong_matches: int


# ─────────────────────────────────────────────────────────────────────────────
# Jobs
# ─────────────────────────────────────────────────────────────────────────────


class JobSalaryRange(BaseModel):
    currency: str
    min: int
    max: int


class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str
    type: str
    workMode: str
    salaryRange: JobSalaryRange
    postedDaysAgo: int
    description: str
    responsibilities: list[str]
    requirements: list[str]
    preferred: list[str]
    skills: list[Skill]
    tags: list[str]
    matchScore: Optional[float] = None
    matchLevel: Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Job Matches
# ─────────────────────────────────────────────────────────────────────────────


class MatchBreakdown(BaseModel):
    category: MatchCategory
    score: float
    weight: float
    note: str


class MissingSkill(BaseModel):
    skill: str
    importance: Importance


class JobMatchOut(BaseModel):
    id: int
    jobId: str
    score: float
    level: MatchLevel
    summary: str
    breakdown: list[MatchBreakdown]
    strengths: list[str]
    gaps: list[str]
    missingSkills: list[MissingSkill]
    job: Optional[JobOut] = None

    model_config = {"from_attributes": True}


class SaveMatchRequest(BaseModel):
    job_id: str
    score: float
    level: MatchLevel
    summary: str
    breakdown: list[MatchBreakdown]
    strengths: list[str]
    gaps: list[str]
    missing_skills: list[MissingSkill]


# ─────────────────────────────────────────────────────────────────────────────
# Activity Log
# ─────────────────────────────────────────────────────────────────────────────


class ActivityLogOut(BaseModel):
    id: int
    action: str
    title: str
    description: str
    score: Optional[float] = None
    href: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LogActivityRequest(BaseModel):
    action: str
    title: str
    description: str
    score: Optional[float] = None
    href: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Generic responses
# ─────────────────────────────────────────────────────────────────────────────


class MessageResponse(BaseModel):
    message: str