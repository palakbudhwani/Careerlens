# CareerLens — AI Resume Job Matching & Mock Interview Platform

CareerLens is a premium AI-powered career-tech platform. It analyzes resumes against target job descriptions to calculate ATS match scores, identify missing skills/gaps, and generate custom practice interviews. 

It features a robust client interface built in React and a secure Express backend powered by Gemini generative models.

---

## Key Features

1. **ATS Match Analysis**: Upload a PDF resume to parse contents in real time, score your ATS alignment, identify matching strengths, and discover missing skill gaps.
2. **Dual-Questionnaire Interview Generator**: Generates two distinct question sets:
   * **Resume-Based**: Scans your resume text and target projects to ask pinpointed technical questions about your actual work 
   * **Role-Based**: Evaluates technical capability against the job's core requirements.
3. **Proctored AI Mock Interview Workspace**: 
   * **Round 1 (Aptitude)**: Logic and reasoning Multiple Choice Questions (MCQs).
   * **Round 2 (Technical)**: Coding scenario questions with simulated speech dictation inputs.
   * **Round 3 (HR & Behavioral)**: Cultural alignment and career motivation interview.
   * **Automated Proctoring**: Tracks tab focus shifts or window minimization. Exceeding 3 alerts automatically flags the session as terminated due to cheating.
   * **AI Scorecard**: Generates average scores per round, checklists of observed strengths, and custom improvement plans.

---

## Tech Stack

### Frontend:
* **React 19** + **Vite 8** + TypeScript (strict)
* **Tailwind CSS v4** (CSS-first config, class-based dark mode)
* **React Router v7**
* **Lucide React** (Icons) & **Framer Motion** (Micro-animations)

### Backend:
* **Node.js** + **Express**
* **@google/genai** — Gemini structured responses using OpenAPI schemas
* **pdf-parse** — Server-side text extraction from PDF uploads
* **Multer** — Memory buffer file upload stream handling

---

## Getting Started

### 1. Configure your Gemini API Key
Navigate to [Google AI Studio](https://aistudio.google.com/), generate a free API key, and add it inside [`backend/.env`](file:///c:/Users/palak/Downloads/Careerlens(new)/Careerlens/backend/.env):
```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
```
*Note: If no API key is specified, the backend runs in a smart offline fallback mode containing regex heuristics to parse resume details and yield realistic evaluations.*

### 2. Setup and Launch
A post-installation hook is configured to set up both projects in one step. Run these commands from the root directory:

```bash
# Install both root and backend dependencies automatically
npm install

# Start both Vite frontend (port 5173) & Express backend (port 5000) concurrently
npm run dev

# Run typechecks and compile production bundle
npm run build
```

---

## Project Structure

```
├── backend/
│   ├── server.js               # Express application and route handlers
│   ├── llm.js                  # Gemini LLM wrappers and ATS parser schemas
│   ├── mockInterviewStore.js   # In-memory session DB for proctored interviews
│   ├── mockInterviewLlm.js     # Interview question generators & grading prompts
│   └── package.json            # Backend dependencies
├── src/
│   ├── components/             # Layouts, Sidebar, Header, UI primitives
│   ├── data/                   # Sidebar navigation items and mock job seeds
│   ├── lib/                    # API client service adapter layer (api-service.ts)
│   ├── pages/                  # Page views: match.tsx, mock-interview.tsx, dashboard.tsx
│   └── routes/                 # Router mapping (index.tsx)
└── package.json                # Root concurrently development runner script
```
