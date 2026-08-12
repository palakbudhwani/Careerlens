"""
python data/seed.py
Seeds the jobs table with the 6 jobs from the frontend src/data/jobs.ts.
Safe to run multiple times (upserts by id).
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.database import engine, SessionLocal, Base
from models.user import Job

JOBS = [
    {
        "id": "job-001",
        "title": "Senior Frontend Engineer",
        "company": "Nimbus AI",
        "location": "New York, NY",
        "job_type": "full-time",
        "work_mode": "hybrid",
        "salary_currency": "USD",
        "salary_min": 165000,
        "salary_max": 195000,
        "posted_days_ago": 3,
        "description": "We are looking for a senior frontend engineer to build the interface layer of our AI analytics platform. You will own the experience from mockup to production, working closely with ML engineers to surface model insights to 20k+ users.",
        "responsibilities": [
            "Design and build complex, data-dense React interfaces.",
            "Partner with ML engineers to ship AI-assisted features end to end.",
            "Maintain and evolve the company design system.",
            "Champion performance, accessibility, and test coverage.",
        ],
        "requirements": [
            "6+ years building production React applications with TypeScript.",
            "Deep experience with state management, testing, and performance profiling.",
            "Strong product sense and cross-functional communication.",
        ],
        "preferred": [
            "Experience with design systems at scale.",
            "Exposure to LLM-based features or prompt workflows.",
            "Familiarity with GraphQL and Node.js tooling.",
        ],
        "skills": [
            {"id": "j1-ts",     "name": "TypeScript",          "category": "technical", "proficiency": 5},
            {"id": "j1-react",  "name": "React",               "category": "technical", "proficiency": 5},
            {"id": "j1-design", "name": "Design Systems",      "category": "technical", "proficiency": 4},
            {"id": "j1-test",   "name": "Testing & CI",        "category": "technical", "proficiency": 4},
            {"id": "j1-lead",   "name": "Technical Leadership","category": "soft",      "proficiency": 4},
        ],
        "tags": ["React", "TypeScript", "Design Systems", "AI Products"],
    },
    {
        "id": "job-002",
        "title": "Staff Frontend Engineer — ML Platform",
        "company": "Vector Labs",
        "location": "San Francisco, CA",
        "job_type": "full-time",
        "work_mode": "remote",
        "salary_currency": "USD",
        "salary_min": 190000,
        "salary_max": 230000,
        "posted_days_ago": 6,
        "description": "Help us build the frontend that makes an internal ML training platform usable by researchers and engineers across the company. This is a staff-level role with platform-wide influence.",
        "responsibilities": [
            "Own the architecture of a large, multi-team frontend codebase.",
            "Build tooling and primitives other engineers build products on.",
            "Drive technical roadmap with engineering and product leadership.",
        ],
        "requirements": [
            "8+ years of frontend engineering with deep TypeScript + React expertise.",
            "Proven track record of platform-level architectural decisions.",
            "Experience mentoring senior engineers.",
        ],
        "preferred": [
            "Experience working adjacent to ML or data-infrastructure teams.",
            "Prior work on internal developer tooling.",
        ],
        "skills": [
            {"id": "j2-ts",     "name": "TypeScript",          "category": "technical", "proficiency": 5},
            {"id": "j2-react",  "name": "React",               "category": "technical", "proficiency": 5},
            {"id": "j2-arch",   "name": "Frontend Architecture","category": "technical","proficiency": 4},
            {"id": "j2-mentor", "name": "Mentorship",          "category": "soft",      "proficiency": 5},
        ],
        "tags": ["Staff", "ML Platform", "Remote", "TypeScript"],
    },
    {
        "id": "job-003",
        "title": "AI Product Engineer",
        "company": "Lumenworks",
        "location": "Remote",
        "job_type": "full-time",
        "work_mode": "remote",
        "salary_currency": "USD",
        "salary_min": 170000,
        "salary_max": 210000,
        "posted_days_ago": 2,
        "description": "Join a small, senior team building AI-native workflow products. You will prototype interfaces that put LLM capabilities in the hands of non-technical users, and ship them to production.",
        "responsibilities": [
            "Prototype and ship AI-native features across web surfaces.",
            "Own the full frontend product lifecycle in a small team.",
            "Experiment with prompt patterns and LLM integration.",
        ],
        "requirements": [
            "5+ years of React + TypeScript experience.",
            "Comfort working autonomously in a fast-moving environment.",
            "Strong product instincts and design collaboration.",
        ],
        "preferred": [
            "Hands-on experience with LLM APIs or AI SDKs.",
            "Familiarity with prompt engineering and evaluation.",
        ],
        "skills": [
            {"id": "j3-react",   "name": "React",              "category": "technical", "proficiency": 5},
            {"id": "j3-llm",     "name": "LLM Integration",    "category": "technical", "proficiency": 3},
            {"id": "j3-prompt",  "name": "Prompt Engineering", "category": "technical", "proficiency": 2},
            {"id": "j3-product", "name": "Product Thinking",   "category": "soft",      "proficiency": 4},
        ],
        "tags": ["AI Native", "LLM", "Small Team", "Remote"],
    },
    {
        "id": "job-004",
        "title": "Full-Stack Engineer — AI SaaS",
        "company": "Cascade",
        "location": "Austin, TX",
        "job_type": "full-time",
        "work_mode": "hybrid",
        "salary_currency": "USD",
        "salary_min": 150000,
        "salary_max": 180000,
        "posted_days_ago": 11,
        "description": "Own features across the stack for a fast-growing AI SaaS product. Frontend-heavy work with opportunities to touch Node.js services and data pipelines.",
        "responsibilities": [
            "Build end-to-end features with TypeScript across frontend and backend.",
            "Collaborate with design and data teams to ship AI features.",
            "Improve frontend performance and developer experience.",
        ],
        "requirements": [
            "5+ years of full-stack experience with TypeScript and React.",
            "Node.js service development and API design.",
            "Comfort with a start-up cadence.",
        ],
        "preferred": [
            "Experience with Postgres or other SQL databases.",
            "Experience building with LLM APIs.",
        ],
        "skills": [
            {"id": "j4-ts",   "name": "TypeScript",   "category": "technical", "proficiency": 5},
            {"id": "j4-node", "name": "Node.js",      "category": "technical", "proficiency": 4},
            {"id": "j4-sql",  "name": "SQL / Postgres","category": "technical","proficiency": 2},
            {"id": "j4-ai",   "name": "LLM APIs",     "category": "technical", "proficiency": 2},
        ],
        "tags": ["Full-Stack", "Node.js", "TypeScript"],
    },
    {
        "id": "job-005",
        "title": "Machine Learning Engineer",
        "company": "Atlas Insight",
        "location": "Seattle, WA",
        "job_type": "full-time",
        "work_mode": "hybrid",
        "salary_currency": "USD",
        "salary_min": 180000,
        "salary_max": 220000,
        "posted_days_ago": 8,
        "description": "Build and deploy ML models that power predictive analytics for enterprise customers. A deeply technical role for engineers who live in Python and PyTorch.",
        "responsibilities": [
            "Design, train, and deploy models into production.",
            "Own model evaluation and monitoring pipelines.",
            "Partner with data engineering on feature infrastructure.",
        ],
        "requirements": [
            "4+ years of ML engineering with strong Python and PyTorch.",
            "Experience deploying models in production at scale.",
            "Solid fundamentals in statistics and evaluation.",
        ],
        "preferred": ["Experience with Kubernetes and MLOps tooling."],
        "skills": [
            {"id": "j5-python", "name": "Python",    "category": "technical", "proficiency": 5},
            {"id": "j5-torch",  "name": "PyTorch",   "category": "technical", "proficiency": 5},
            {"id": "j5-ml",     "name": "Applied ML","category": "technical", "proficiency": 5},
            {"id": "j5-mlops",  "name": "MLOps",     "category": "tool",      "proficiency": 4},
        ],
        "tags": ["Python", "PyTorch", "MLOps"],
    },
    {
        "id": "job-006",
        "title": "Frontend Platform Engineer",
        "company": "Dextrus",
        "location": "Remote",
        "job_type": "contract",
        "work_mode": "remote",
        "salary_currency": "USD",
        "salary_min": 140000,
        "salary_max": 165000,
        "posted_days_ago": 15,
        "description": "A 9-month contract to build the frontend build pipeline and developer tooling for a high-growth product org.",
        "responsibilities": [
            "Own the frontend build system and CI pipelines.",
            "Develop shared packages and module federation strategy.",
            "Instrument performance budgets across major surfaces.",
        ],
        "requirements": [
            "6+ years of frontend engineering with deep tooling expertise.",
            "Strong experience with CI/CD, bundlers, and monorepos.",
        ],
        "preferred": ["Experience with Design Tokens and multi-brand theming."],
        "skills": [
            {"id": "j6-tooling", "name": "Build Tooling","category": "tool",      "proficiency": 4},
            {"id": "j6-ci",      "name": "CI/CD",        "category": "tool",      "proficiency": 4},
            {"id": "j6-ts",      "name": "TypeScript",   "category": "technical", "proficiency": 5},
            {"id": "j6-mono",    "name": "Monorepos",    "category": "tool",      "proficiency": 3},
        ],
        "tags": ["Tooling", "CI/CD", "Contract"],
    },
]


def seed():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seeded = 0
        for data in JOBS:
            existing = db.query(Job).filter(Job.id == data["id"]).first()
            if existing:
                # Update all fields
                for k, v in data.items():
                    setattr(existing, k, v)
                print(f"  ↻  Updated  {data['id']}: {data['title']}")
            else:
                job = Job(**data)
                db.add(job)
                print(f"  ✚  Seeded   {data['id']}: {data['title']}")
                seeded += 1
        db.commit()
        print(f"\n✅  Done. {seeded} new jobs inserted.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
