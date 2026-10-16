// ---------------------------------------------------------------------------
// Curated interview question bank — deterministic third-tier fallback.
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// The provider layer (aiProvider.js) tries Gemini, then a single Groq
// fallback. The task layer (llm.js generateQuestions) additionally validates
// that whatever the providers return honours the question contract (exact
// resume/role split and every field populated). When BOTH providers fail or
// are disabled, or the AI output violates that contract, this module answers
// from a fixed, curated bank instead of a handful of generic templates: every
// question is selected from the resume / job description / difficulty inputs
// by a documented, reproducible scoring function, and template text is filled
// only with entities actually found in those inputs. Nothing is invented, no
// network call is made, and the caller labels the result 'Rule-based
// fallback'.
//
// SELECTION METHOD (deterministic for identical inputs):
//  1. Candidate instances are built per bank entry from real evidence:
//     resume anchors = project / experience / education / certification /
//                      skill (vocabulary scan) / keyword (domain terms that
//                      are not in the skill vocabulary) / none;
//     role anchors   = gap (JD requirement missing from the resume) /
//                      jdSkill (JD requirement already evidenced) /
//                      jobTitle (inferred from the JD's first line) / none.
//  2. Each candidate scores:
//       base          (anchor base, or the entry's explicit override)
//       + prominence  (occurrences of the value in its source text, capped 4)
//       + difficulty  (|entry level - requested level|: 0 -> 2, 1 -> 1, else 0)
//       + keyword hit (+6 for non-vocabulary domain terms)
//       + diversity   (later picks only: +4 for a new category, -6 when that
//                      category was already used)
//       - anchor repeat (-8 when the anchor type was already used)
//  3. Picks run greedily (scores re-computed after each pick) under hard
//     constraints: one question per bank entry, one per normalized value, and
//     near-duplicate text (Jaccard >= 0.85 on filled question tokens) is
//     skipped — the near-duplicate rule is the only one relaxed when the
//     pool would otherwise starve. Ties break on score, then the value's
//     position in the source text, then a sha256 tiebreak of
//     (seed, entry id, value), then bank order.
//  4. Generic (anchor 'none') entries exist on both sides so any input can
//     always fill the requested counts.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

/** Base score per anchor type; an entry's own `base` overrides it. */
export const ANCHOR_BASE = {
  project: 100,
  experience: 92,
  gap: 88,
  skill: 80,
  jdSkill: 80,
  certification: 75,
  education: 70,
  jobTitle: 60,
  none: 10
};

const DIFFICULTY_LEVELS = { Junior: 0, Mid: 1, Senior: 2, Lead: 3 };
const PROMINENCE_CAP = 4;
const KEYWORD_HIT_BONUS = 6;
const CATEGORY_NEW_BONUS = 4;
const CATEGORY_REPEAT_PENALTY = 6;
const ANCHOR_REPEAT_PENALTY = 8;
const NEAR_DUP_JACCARD = 0.85;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive whole-word matcher for a free-form term. */
function wordMatcher(term) {
  const escaped = escapeRegex(String(term).toLowerCase());
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
}

/** Position of `term` in `text`, or -1 when it does not appear. */
function positionOf(text, term) {
  const match = wordMatcher(term).exec(String(text || ''));
  return match ? match.index + String(match[1] || '').length : -1;
}

/** Occurrence count of `term` as a whole word in `text`. */
function countWord(text, term) {
  const global = new RegExp(wordMatcher(term).source, 'gi');
  return (String(text || '').match(global) || []).length;
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2)
  );
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

/** Replace `{slot}` placeholders; unknown slots collapse to nothing. */
function fillTemplate(template, slots = {}) {
  return String(template)
    .replace(/\{(\w+)\}/g, (_, key) => {
      const value = slots[key];
      return value === undefined || value === null ? '' : String(value);
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function difficultyBonus(entryDifficulty, requestedDifficulty) {
  const entryLevel = DIFFICULTY_LEVELS[entryDifficulty];
  const requestedLevel = DIFFICULTY_LEVELS[requestedDifficulty];
  if (entryLevel === undefined || requestedLevel === undefined) return 0;
  const delta = Math.abs(entryLevel - requestedLevel);
  return delta === 0 ? 2 : delta === 1 ? 1 : 0;
}

function hashTiebreak(seed, entryId, value) {
  return createHash('sha256')
    .update(`${seed}|${entryId}|${value === null || value === undefined ? '' : value}`)
    .digest('hex')
    .slice(0, 12);
}

const TITLE_SENTENCE_RE = /\b(we are|about the|job description|requirements|hiring|looking for|responsibilities)\b/i;

/**
 * Best-effort target-role title from the job description's first line.
 * Sentence-like or oversized lines fall back to 'this role' so templates
 * always read naturally.
 */
export function inferJobTitle(jobDescription) {
  const firstLine = String(jobDescription || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
  if (!firstLine) return 'this role';
  const stripped = firstLine.replace(/\s+at\s+.+$/i, '').trim();
  if (stripped.length < 3) return 'this role';
  if (/[.!?:;,]$/.test(stripped)) return 'this role';
  if (stripped.split(/\s+/).length > 10) return 'this role';
  if (TITLE_SENTENCE_RE.test(stripped)) return 'this role';
  return stripped;
}

// ---------------------------------------------------------------------------
// The bank: groups of curated entries. Each entry becomes candidate question
// instances only when the matching evidence exists in the inputs. Fields:
//   id       unique across the whole bank
//   anchor   which input value(s) fill the template (see header)
//   difficulty  entry difficulty level (Junior | Mid | Senior | Lead)
//   skills   optional vocabulary skill names this entry is limited to
//   keywords optional non-vocabulary domain terms (word-matched in text)
//   type     question type shown in the UI
//   question / context / sampleAnswerOutline / evalCriteria  output fields
//   base     optional explicit score base (overrides ANCHOR_BASE)
// ---------------------------------------------------------------------------

export const QUESTION_BANK = [
  {
    key: 'core',
    label: 'Resume Foundations',
    resume: [
      {
        id: 'core-exp-ownership',
        anchor: 'experience',
        difficulty: 'Mid',
        type: 'Experience-Based',
        question: 'As the {role} at "{company}", what ownership did you have, and which deliverable are you most proud of?',
        context: 'Targets your experience at "{company}" listed on your resume.',
        sampleAnswerOutline: [
          'Describe your day-to-day as {role}.',
          'Name one shipped deliverable you owned.',
          'Explain how you coordinated with the team.',
          'State the impact it had.'
        ],
        evalCriteria: 'Looks for role clarity, delivery ownership, and teamwork.'
      },
      {
        id: 'core-exp-tradeoff',
        anchor: 'experience',
        difficulty: 'Mid',
        type: 'Experience-Based',
        question: 'At "{company}", describe a difficult technical trade-off you made and how you explained it to stakeholders.',
        context: 'Checks decision-making and communication during your time at "{company}".',
        sampleAnswerOutline: [
          'Set the context and constraints.',
          'Explain the options you weighed.',
          'Describe how you communicated the choice.',
          'Share the outcome and lessons.'
        ],
        evalCriteria: 'Checks judgment, stakeholder communication, and outcomes under constraints.'
      },
      {
        id: 'core-education',
        anchor: 'education',
        difficulty: 'Mid',
        type: 'Coursework-Based',
        question: 'Your resume lists "{education}". Which concepts from that program do you apply most in your work today?',
        context: 'Connects your academic background with your day-to-day work.',
        sampleAnswerOutline: [
          'Name two relevant subjects or concepts.',
          'Give a work example using each.',
          'Explain how the theory shaped your practice.',
          'Mention gaps you filled independently.'
        ],
        evalCriteria: 'Assesses ability to connect academics with real engineering work.'
      },
      {
        id: 'core-certification',
        anchor: 'certification',
        difficulty: 'Mid',
        type: 'Coursework-Based',
        question: 'What did preparing for "{certification}" involve, and how has it changed the way you work?',
        context: 'Covers the "{certification}" entry on your resume.',
        sampleAnswerOutline: [
          'Describe what the certification covered.',
          'Explain how you prepared.',
          'Give one practice change you adopted.',
          'State how it helps your current role.'
        ],
        evalCriteria: 'Checks structured learning commitment and applied outcomes.'
      },
      {
        id: 'core-skill-general',
        anchor: 'skill',
        difficulty: 'Mid',
        type: 'Experience-Based',
        question: 'How deep does your {skill} experience really go — walk me through the hardest thing you have done with it and what you learned.',
        context: 'Probes practical depth on "{skill}" from your resume.',
        sampleAnswerOutline: [
          'Where you used {skill}.',
          'The hardest problem it involved.',
          'How you worked through it.',
          'The result and what you learned.'
        ],
        evalCriteria: 'Looks for applied, evidence-backed depth with the skill.'
      },
      {
        id: 'core-res-generic-1',
        anchor: 'none',
        difficulty: 'Mid',
        type: 'Project-Based',
        question: 'Walk me through the most complex project on your resume: the goal, your role, and the hardest decision you made.',
        context: 'Assesses depth on the strongest project you listed.',
        sampleAnswerOutline: [
          'State the goal and your role.',
          'Describe the hardest decision.',
          'Explain the alternatives you considered.',
          'Share the outcome.'
        ],
        evalCriteria: 'Looks for ownership, technical depth, and clear outcomes.'
      },
      {
        id: 'core-res-generic-2',
        anchor: 'none',
        difficulty: 'Mid',
        type: 'Experience-Based',
        question: 'What is one accomplishment on your resume you are most proud of, and why did it matter?',
        context: 'Explores impact and motivation behind your work.',
        sampleAnswerOutline: [
          'Describe the accomplishment.',
          'Explain why it mattered.',
          'Name your specific contribution.',
          'State the measurable effect.'
        ],
        evalCriteria: 'Evaluates impact awareness and communication of results.'
      },
      {
        id: 'core-res-generic-3',
        anchor: 'none',
        difficulty: 'Mid',
        type: 'Experience-Based',
        question: 'Which skill on your resume had the steepest learning curve, and how did you become productive with it?',
        context: 'Checks your learning approach for a skill you actually list.',
        sampleAnswerOutline: [
          'Name the skill and why it was hard.',
          'Describe your learning plan.',
          'Give a practice example.',
          'State where you use it now.'
        ],
        evalCriteria: 'Assesses self-directed learning and persistence.'
      },
      {
        id: 'core-res-generic-4',
        anchor: 'none',
        difficulty: 'Senior',
        type: 'Leadership',
        question: 'Tell me about a time you led or mentored others on a delivery — what changed because of your input?',
        context: 'Probes leadership and mentoring evidence from your background.',
        sampleAnswerOutline: [
          'Set the team context.',
          'Describe your specific guidance.',
          'Explain how the team responded.',
          'Share the delivery outcome.'
        ],
        evalCriteria: 'Checks leadership, mentoring, and delivery influence.'
      },
      {
        id: 'core-res-generic-5',
        anchor: 'none',
        difficulty: 'Mid',
        type: 'Experience-Based',
        question: 'Describe a time something you shipped failed for real users. What did you do in the moment, and afterwards?',
        context: 'Tests incident response and accountability.',
        sampleAnswerOutline: [
          'Set the scene briefly.',
          'Explain your immediate actions.',
          'Describe the root cause work.',
          'Share the prevention that followed.'
        ],
        evalCriteria: 'Checks ownership, calm under pressure, and learning from failure.'
      },
      {
        id: 'core-res-generic-6',
        anchor: 'none',
        difficulty: 'Junior',
        type: 'Experience-Based',
        question: 'How do you decide when a piece of work is done, and how do you handle scope changes arriving late in a project?',
        context: 'Covers delivery discipline and scope management.',
        sampleAnswerOutline: [
          'State your definition of done.',
          'Describe your change process.',
          'Explain how you communicate it.',
          'Give a concrete example.'
        ],
        evalCriteria: 'Assesses planning discipline and stakeholder communication.'
      }
    ],
    role: [
      {
        id: 'core-role-jobtitle',
        anchor: 'jobTitle',
        difficulty: 'Mid',
        base: 80,
        type: 'Behavioral',
        question: 'Why are you interested in {jobTitle}, and which part of your background best supports that interest?',
        context: 'Explores your motivation for {jobTitle}.',
        sampleAnswerOutline: [
          'State your motivation.',
          'Cite a supporting experience.',
          'Explain your long-term interest.',
          'Link it to the team goals.'
        ],
        evalCriteria: 'Assesses motivation grounded in real experience.'
      },
      {
        id: 'core-role-fit',
        anchor: 'none',
        difficulty: 'Mid',
        type: 'Technical',
        base: 76,
        question: 'Which part of this role best matches your strongest skill, and how would you apply it in the first month?',
        context: 'Connects your background to the target role.',
        sampleAnswerOutline: [
          'Name your strongest matching skill.',
          'Describe first-month goals.',
          'Give an early win idea.',
          'State how you would measure success.'
        ],
        evalCriteria: 'Checks role fit awareness and practical onboarding thinking.'
      },
      {
        id: 'core-role-growth',
        anchor: 'none',
        difficulty: 'Mid',
        type: 'Behavioral',
        base: 74,
        question: 'Where do you want to grow in this role over the next two years, and what is your plan to get there?',
        context: 'Covers long-term growth expectations for the role.',
        sampleAnswerOutline: [
          'Name the skills you want to build.',
          'Explain why they matter here.',
          'Describe your learning plan.',
          'Share how you track progress.'
        ],
        evalCriteria: 'Assesses growth mindset and structured self-development.'
      },
      {
        id: 'core-role-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        type: 'Gap-Addressing',
        question: 'The job asks for "{gap}", which is not on your resume. How would you get up to speed and prove it quickly?',
        context: 'Addresses the detected gap in "{gap}".',
        sampleAnswerOutline: [
          'Acknowledge the gap honestly.',
          'Outline a concrete learning plan.',
          'Describe a practice project or task.',
          'Explain how you would show evidence.'
        ],
        evalCriteria: 'Looks for honesty, a structured learning plan, and initiative.'
      },
      {
        id: 'core-role-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        type: 'Technical',
        question: 'The role emphasizes "{jdSkill}", which your resume already shows. How would you apply it on day one here?',
        context: 'Covers the job requirement "{jdSkill}" you already evidence.',
        sampleAnswerOutline: [
          'Explain where {jdSkill} fits here.',
          'Name one risk you would watch.',
          'Describe a first-week action.',
          'State how you would measure success.'
        ],
        evalCriteria: 'Checks depth on the required skill you already use.'
      }
    ]
  },
  {
    key: 'projects_resume',
    label: 'Project Depth',
    resume: [
      {
        id: 'proj-challenge',
        anchor: 'project',
        difficulty: 'Mid',
        type: 'Project-Based',
        question: 'In your "{project}" project, what was the main technical challenge you faced, and how did you resolve it?',
        context: 'Targets the "{project}" project listed on your resume.',
        sampleAnswerOutline: [
          'State the goal of "{project}".',
          'Describe the hardest technical problem.',
          'Explain your fix and trade-offs.',
          'Share the measurable outcome.'
        ],
        evalCriteria: 'Looks for hands-on problem solving and ownership of results.'
      },
      {
        id: 'proj-architecture',
        anchor: 'project',
        difficulty: 'Mid',
        type: 'Project-Based',
        question: 'For "{project}", what key architectural decisions did you make, and why did you choose that stack over alternatives?',
        context: 'Explores the design choices behind "{project}".',
        sampleAnswerOutline: [
          'Describe the problem it solved.',
          'List the options you considered.',
          'Justify the chosen stack.',
          'State what you would change next time.'
        ],
        evalCriteria: 'Evaluates architectural reasoning and trade-off analysis.'
      },
      {
        id: 'proj-quality',
        anchor: 'project',
        difficulty: 'Mid',
        type: 'Project-Based',
        question: 'How did you verify quality and performance in "{project}" before and after its release?',
        context: 'Checks testing and performance practice on "{project}".',
        sampleAnswerOutline: [
          'Mention the tests or checks you added.',
          'Name the metric you tracked.',
          'Describe a bottleneck you found.',
          'Explain the fix and the result.'
        ],
        evalCriteria: 'Checks testing discipline and performance awareness.'
      }
    ],
    role: []
  },
  {
    key: 'behavioral',
    label: 'Behavioral & Collaboration',
    resume: [],
    role: [
      {
        id: 'beh-conflict',
        anchor: 'none',
        difficulty: 'Mid',
        base: 84,
        type: 'Behavioral',
        question: 'Describe a situation where you disagreed with a teammate or manager about a technical approach. How did you resolve it?',
        context: 'Assesses collaboration and conflict resolution.',
        sampleAnswerOutline: [
          'Set the context and disagreement.',
          'Explain your data or reasoning.',
          'Describe the compromise you proposed.',
          'State the final outcome.'
        ],
        evalCriteria: 'Checks communication, evidence-based persuasion, and teamwork.'
      },
      {
        id: 'beh-crossfunctional',
        anchor: 'none',
        difficulty: 'Mid',
        base: 82,
        type: 'Behavioral',
        question: 'This role works with cross-functional partners. How do you keep engineers and non-engineers aligned during delivery?',
        context: 'Covers the collaboration expectation of the role.',
        sampleAnswerOutline: [
          'Describe your communication cadence.',
          'Explain how you translate technical risk.',
          'Give an example of aligning scope.',
          'State the result of that alignment.'
        ],
        evalCriteria: 'Evaluates cross-functional communication and delivery alignment.'
      },
      {
        id: 'beh-ambiguity',
        anchor: 'none',
        difficulty: 'Senior',
        base: 78,
        type: 'Behavioral',
        question: 'Tell me about a time you started work with unclear requirements. How did you create clarity and keep moving?',
        context: 'Probes handling ambiguity and stakeholder alignment.',
        sampleAnswerOutline: [
          'Describe what was unclear.',
          'Explain how you asked questions.',
          'Describe the plan you set.',
          'Share the delivered outcome.'
        ],
        evalCriteria: 'Checks structured thinking under ambiguity.'
      },
      {
        id: 'beh-priorities',
        anchor: 'none',
        difficulty: 'Mid',
        base: 76,
        type: 'Behavioral',
        question: 'When two stakeholders ask for conflicting priorities at the same time, how do you decide what ships first?',
        context: 'Covers prioritization and trade-off communication.',
        sampleAnswerOutline: [
          'State your decision criteria.',
          'Explain how you surface trade-offs.',
          'Describe the communication you send.',
          'Share a past example.'
        ],
        evalCriteria: 'Assesses prioritization logic and stakeholder communication.'
      },
      {
        id: 'beh-feedback',
        anchor: 'none',
        difficulty: 'Junior',
        base: 74,
        type: 'Behavioral',
        question: 'Describe a piece of critical code review feedback that changed your approach. What did you do differently afterward?',
        context: 'Checks how you respond to feedback and improve.',
        sampleAnswerOutline: [
          'Summarize the feedback.',
          'Explain your initial reaction.',
          'Describe the change you made.',
          'Share the longer-term habit.'
        ],
        evalCriteria: 'Checks receptiveness to feedback and continuous improvement.'
      }
    ]
  },
  {
    key: 'python',
    label: 'Python Ecosystem',
    resume: [
      {
        id: 'py-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Python', 'Django', 'Flask', 'FastAPI', 'Bash'],
        type: 'Experience-Based',
        question: 'Tell me about a problem where {skill} was the fastest path to a result — what did you build and how did it hold up?',
        context: 'Probes real-world use of {skill} from your resume.',
        sampleAnswerOutline: [
          'Set the problem and constraints.',
          'Explain why {skill} fit.',
          'Describe what you built.',
          'Share how it performed over time.'
        ],
        evalCriteria: 'Looks for pragmatic tool choice and measurable results.'
      }
    ],
    role: [
      {
        id: 'py-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: ['Python', 'Django', 'Flask', 'FastAPI', 'Bash'],
        type: 'Gap-Addressing',
        question: 'The posting asks for {gap}, which your resume does not show. What is your plan to reach working depth fast?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Acknowledge the missing evidence.',
          'Outline a focused learning plan.',
          'Name a practice build you would ship.',
          'Explain how you would prove it.'
        ],
        evalCriteria: 'Looks for honesty, structure, and speed of learning.'
      },
      {
        id: 'py-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Python', 'Django', 'Flask', 'FastAPI', 'Bash'],
        type: 'Technical',
        question: 'The role leans on {jdSkill}, which you already use. How would you apply it here on day one?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Recall where you used {jdSkill}.',
          'Map it to a first-week task.',
          'Name one risk to watch.',
          'State how you would measure success.'
        ],
        evalCriteria: 'Checks depth and immediate applicability of the skill.'
      }
    ]
  },
  {
    key: 'java',
    label: 'Java Ecosystem',
    resume: [
      {
        id: 'java-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Java', 'Spring Boot'],
        type: 'Experience-Based',
        question: 'Your resume lists {skill}. What was the toughest production incident or bottleneck you traced down with it, and how did you fix it?',
        context: 'Probes production debugging depth with {skill}.',
        sampleAnswerOutline: [
          'Describe the symptom you saw.',
          'Explain how you narrowed it down.',
          'Describe the fix you shipped.',
          'Share the prevention you added.'
        ],
        evalCriteria: 'Checks systematic debugging and production ownership.'
      }
    ],
    role: [
      {
        id: 'java-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: ['Java', 'Spring Boot'],
        type: 'Gap-Addressing',
        question: 'You have no shown experience with {gap}. How would you close that gap and prove competency in a pairing or take-home session?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Admit the gap plainly.',
          'Describe your study plan.',
          'Name a project you would build.',
          'Explain how you would demonstrate it.'
        ],
        evalCriteria: 'Looks for honesty, a concrete plan, and proof of skill.'
      },
      {
        id: 'java-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Java', 'Spring Boot'],
        type: 'Technical',
        question: 'Your resume covers {jdSkill}. What is the most sophisticated way you have used it, and what would you do differently now?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Describe your deepest use of {jdSkill}.',
          'Explain the trade-offs involved.',
          'Name what you would change.',
          'Apply the lesson to this role.'
        ],
        evalCriteria: 'Checks sophistication of experience and reflection.'
      }
    ]
  },
  {
    key: 'javascript_typescript',
    label: 'JavaScript & TypeScript',
    resume: [
      {
        id: 'js-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: ['JavaScript', 'TypeScript'],
        type: 'Experience-Based',
        question: 'How has {skill} shaped the way you structure code and catch mistakes before review? Give a concrete example.',
        context: 'Probes how {skill} changed your engineering practice.',
        sampleAnswerOutline: [
          'Give the concrete example.',
          'Explain the structure it forced.',
          'Describe mistakes it caught.',
          'State the team impact.'
        ],
        evalCriteria: 'Checks engineering discipline and practical type or language depth.'
      }
    ],
    role: [
      {
        id: 'js-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: ['JavaScript', 'TypeScript'],
        type: 'Gap-Addressing',
        question: '{gap} appears in the job description but not on your resume. How would you get productive with it before your first ticket?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Acknowledge the gap openly.',
          'Lay out a learning path.',
          'Name an exercise or small build.',
          'Explain how you would show readiness.'
        ],
        evalCriteria: 'Looks for initiative, structure, and honest self-assessment.'
      },
      {
        id: 'js-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: ['JavaScript', 'TypeScript'],
        type: 'Technical',
        question: 'You already list {jdSkill}. Where does it fit in this role, and what is the first improvement you would make with it?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Locate where {jdSkill} fits.',
          'Propose a first improvement.',
          'Explain the risk you would watch.',
          'Define how you would measure it.'
        ],
        evalCriteria: 'Checks immediate value and improvement instincts.'
      }
    ]
  },
  {
    key: 'react_frontend',
    label: 'Frontend & React',
    resume: [
      {
        id: 'fe-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'React', 'Next.js', 'Redux', 'Vue.js', 'Angular', 'React Native',
          'Tailwind CSS', 'Sass/SCSS', 'HTML', 'CSS', 'Accessibility',
          'Responsive Design', 'State Management', 'Design Systems',
          'Performance Optimization', 'Storybook', 'Vite', 'Webpack'
        ],
        type: 'Project-Based',
        question: 'Walk through a feature you shipped using {skill} from idea to production: your architecture choices, the hardest bug, and the final outcome.',
        context: 'Traces a shipped {skill} feature end to end.',
        sampleAnswerOutline: [
          'Describe the feature and goal.',
          'Explain your architecture choices.',
          'Detail the hardest bug.',
          'Share the shipped outcome.'
        ],
        evalCriteria: 'Checks end-to-end delivery and frontend problem solving.'
      }
    ],
    role: [
      {
        id: 'fe-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: [
          'React', 'Next.js', 'Redux', 'Vue.js', 'Angular', 'React Native',
          'Tailwind CSS', 'Sass/SCSS', 'HTML', 'CSS', 'Accessibility',
          'Responsive Design', 'State Management', 'Design Systems',
          'Performance Optimization', 'Storybook', 'Vite', 'Webpack'
        ],
        type: 'Gap-Addressing',
        question: 'This role needs {gap} and your resume does not mention it. Where would you start, and what would you ship first?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Admit the gap and its risk.',
          'Describe where you would start.',
          'Name what you would ship first.',
          'Explain how you would show progress.'
        ],
        evalCriteria: 'Looks for honesty, prioritization, and early proof of work.'
      },
      {
        id: 'fe-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'React', 'Next.js', 'Redux', 'Vue.js', 'Angular', 'React Native',
          'Tailwind CSS', 'Sass/SCSS', 'HTML', 'CSS', 'Accessibility',
          'Responsive Design', 'State Management', 'Design Systems',
          'Performance Optimization', 'Storybook', 'Vite', 'Webpack'
        ],
        type: 'Technical',
        question: 'This job emphasizes {jdSkill}, which your resume evidences. Show how you would raise the bar with it on this team.',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Cite your strongest {jdSkill} use.',
          'Propose a bar-raising change here.',
          'Name a risk you would guard.',
          'State how you would measure it.'
        ],
        evalCriteria: 'Checks depth and improvement mindset on the skill.'
      }
    ]
  },
  {
    key: 'backend_rest',
    label: 'Backend & APIs',
    resume: [
      {
        id: 'api-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'Node.js', 'Express', 'REST APIs', 'GraphQL', 'WebSockets',
          'API Integration', 'Microservices', 'System Design',
          'Data Structures & Algorithms', 'Operating Systems', 'Computer Networks'
        ],
        type: 'Experience-Based',
        question: 'Describe your {skill} system design end to end. What decisions around contracts, failures, and scale were hardest?',
        context: 'Probes design depth on {skill} from your resume.',
        sampleAnswerOutline: [
          'Describe the system and its users.',
          'Explain the contract decisions.',
          'Cover failure and scale choices.',
          'State what you would revisit.'
        ],
        evalCriteria: 'Checks systems thinking and trade-off reasoning.'
      }
    ],
    role: [
      {
        id: 'api-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: [
          'Node.js', 'Express', 'REST APIs', 'GraphQL', 'WebSockets',
          'API Integration', 'Microservices', 'System Design',
          'Data Structures & Algorithms', 'Operating Systems', 'Computer Networks'
        ],
        type: 'Gap-Addressing',
        question: 'How would you approach {gap} on the job given your resume does not cover it yet? Be specific about your first week.',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Acknowledge the missing coverage.',
          'Plan your first-week learning.',
          'Name a task you would pair on.',
          'Explain how you would prove readiness.'
        ],
        evalCriteria: 'Looks for concreteness, humility, and a workable ramp plan.'
      },
      {
        id: 'api-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'Node.js', 'Express', 'REST APIs', 'GraphQL', 'WebSockets',
          'API Integration', 'Microservices', 'System Design',
          'Data Structures & Algorithms', 'Operating Systems', 'Computer Networks'
        ],
        type: 'Technical',
        question: 'How would you use {jdSkill} in this role’s architecture? Name one risk you would watch and how you would measure success.',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Place {jdSkill} in the architecture.',
          'Name the key risk.',
          'Describe your instrumentation.',
          'Define the success metric.'
        ],
        evalCriteria: 'Checks architectural judgment and measurement habits.'
      }
    ]
  },
  {
    key: 'sql_databases',
    label: 'SQL & Databases',
    resume: [
      {
        id: 'db-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DBMS'],
        type: 'Experience-Based',
        question: 'Your resume lists {skill}. Describe the hardest query, schema, or performance problem you solved with it and how you verified the fix.',
        context: 'Probes database problem solving with {skill}.',
        sampleAnswerOutline: [
          'Describe the problem you hit.',
          'Explain your schema or query change.',
          'Show how you verified it.',
          'Share the measured result.'
        ],
        evalCriteria: 'Checks database depth and verification discipline.'
      }
    ],
    role: [
      {
        id: 'db-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DBMS'],
        type: 'Gap-Addressing',
        question: 'The job lists {gap} as required, but your background does not evidence it. What learning path and proof of skill would you follow?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'State the gap clearly.',
          'Choose a learning path.',
          'Describe proof you would build.',
          'Explain how you would apply it here.'
        ],
        evalCriteria: 'Looks for structure, evidence building, and follow-through.'
      },
      {
        id: 'db-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DBMS'],
        type: 'Technical',
        question: 'You have {jdSkill} in your background. What is the hardest real-world problem you solved with it, and what did you learn?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Recount the hardest problem.',
          'Explain your approach.',
          'Describe the outcome.',
          'State what you learned.'
        ],
        evalCriteria: 'Checks applied experience and reflection.'
      }
    ]
  },
  {
    key: 'data_analytics',
    label: 'Data Analytics',
    resume: [
      {
        id: 'da-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Pandas', 'NumPy', 'Data Analysis', 'Data Visualization', 'Statistics'],
        type: 'Experience-Based',
        question: 'Tell me about an analysis you ran end to end with {skill}: the question, the method, and the decision it changed.',
        context: 'Traces a decision-changing analysis using {skill}.',
        sampleAnswerOutline: [
          'State the question you answered.',
          'Describe the method and data.',
          'Explain the decision it changed.',
          'Share how you validated it.'
        ],
        evalCriteria: 'Checks analytical rigor and business impact.'
      }
    ],
    role: [
      {
        id: 'da-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: ['Pandas', 'NumPy', 'Data Analysis', 'Data Visualization', 'Statistics'],
        type: 'Gap-Addressing',
        question: 'Your resume misses {gap} while the role requires it. How would you build practical competence and demonstrate it quickly?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Acknowledge the shortfall.',
          'Plan hands-on practice.',
          'Name evidence you would produce.',
          'Explain how you would apply it here.'
        ],
        evalCriteria: 'Looks for proactive learning and demonstrable evidence.'
      },
      {
        id: 'da-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Pandas', 'NumPy', 'Data Analysis', 'Data Visualization', 'Statistics'],
        type: 'Technical',
        question: 'The team needs {jdSkill}, which you already bring. How would you apply it to our data and what would you check first?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Recall your {jdSkill} work.',
          'Describe your first analysis here.',
          'Name what you would check first.',
          'State the success signal.'
        ],
        evalCriteria: 'Checks immediate applicability and sound defaults.'
      }
    ]
  },
  {
    key: 'machine_learning',
    label: 'Machine Learning',
    resume: [
      {
        id: 'ml-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow',
          'scikit-learn', 'NLP', 'Computer Vision', 'MLOps', 'MLflow'
        ],
        type: 'Experience-Based',
        question: 'Describe something you built with {skill} and took toward production. What broke between the prototype and real-world traffic?',
        context: 'Traces a {skill} system from prototype toward production.',
        sampleAnswerOutline: [
          'Describe the model or system.',
          'Explain the prototype stage.',
          'Detail what broke in production.',
          'Share the fix and outcome.'
        ],
        evalCriteria: 'Checks production awareness beyond notebooks.'
      }
    ],
    role: [
      {
        id: 'ml-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: [
          'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow',
          'scikit-learn', 'NLP', 'Computer Vision', 'MLOps', 'MLflow'
        ],
        type: 'Gap-Addressing',
        question: '{gap} is a stated requirement you have not shown yet. Walk me through how you would learn it and apply it here.',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Own the missing evidence.',
          'Describe your learning route.',
          'Plan a applied exercise.',
          'Explain how you would prove it.'
        ],
        evalCriteria: 'Looks for a credible learning plan and initiative.'
      },
      {
        id: 'ml-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow',
          'scikit-learn', 'NLP', 'Computer Vision', 'MLOps', 'MLflow'
        ],
        type: 'Technical',
        question: 'Your resume shows {jdSkill}. How would you apply it at our scale, and which failure modes would you guard against early?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Map {jdSkill} to our scale.',
          'Name early failure modes.',
          'Describe your guardrails.',
          'State how you would monitor.'
        ],
        evalCriteria: 'Checks scale awareness and defensive ML practices.'
      }
    ]
  },
  {
    key: 'ai_genai',
    label: 'AI & Generative AI',
    resume: [
      {
        id: 'ai-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'LLM APIs', 'RAG', 'LangChain', 'Hugging Face', 'Prompt Engineering',
          'Generative AI', 'Gemini API', 'OpenAI API', 'Embeddings', 'Vector Databases'
        ],
        type: 'Project-Based',
        question: 'Your resume shows {skill}. Describe a feature you built with it and how you kept quality, latency, and cost under control.',
        context: 'Probes delivery discipline around {skill}.',
        sampleAnswerOutline: [
          'Describe the feature you shipped.',
          'Explain the quality controls.',
          'Cover latency and cost trade-offs.',
          'Share the measured results.'
        ],
        evalCriteria: 'Checks real delivery constraints on AI features.'
      }
    ],
    role: [
      {
        id: 'ai-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: [
          'LLM APIs', 'RAG', 'LangChain', 'Hugging Face', 'Prompt Engineering',
          'Generative AI', 'Gemini API', 'OpenAI API', 'Embeddings', 'Vector Databases'
        ],
        type: 'Gap-Addressing',
        question: 'Given no {gap} on your resume, how would you become useful with it in this role, and how would you show you are?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Admit the gap directly.',
          'Describe focused learning.',
          'Plan evidence you would show.',
          'Explain your ramp timeline.'
        ],
        evalCriteria: 'Looks for honesty, focus, and a proof plan.'
      },
      {
        id: 'ai-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'LLM APIs', 'RAG', 'LangChain', 'Hugging Face', 'Prompt Engineering',
          'Generative AI', 'Gemini API', 'OpenAI API', 'Embeddings', 'Vector Databases'
        ],
        type: 'Technical',
        question: 'We rely on {jdSkill}, which you already have. How would you use it here while keeping quality and cost in check?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Place {jdSkill} in our workflow.',
          'Describe quality checks.',
          'Explain cost controls.',
          'State the metric you would track.'
        ],
        evalCriteria: 'Checks practical AI engineering and cost awareness.'
      }
    ]
  },
  {
    key: 'cloud_devops',
    label: 'Cloud & DevOps',
    resume: [
      {
        id: 'ops-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform',
          'CI/CD', 'Jenkins', 'GitHub Actions', 'Git', 'GitHub', 'GitLab',
          'Linux', 'Nginx'
        ],
        type: 'Experience-Based',
        question: 'Describe a change you owned that involved {skill}. What failed during rollout, and how did you detect and recover from it?',
        context: 'Probes rollout and recovery experience with {skill}.',
        sampleAnswerOutline: [
          'Describe the change you shipped.',
          'Explain what failed in rollout.',
          'Detail how you detected it.',
          'Share the recovery and safeguards.'
        ],
        evalCriteria: 'Checks operational ownership and recovery instincts.'
      }
    ],
    role: [
      {
        id: 'ops-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: [
          'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform',
          'CI/CD', 'Jenkins', 'GitHub Actions', 'Git', 'GitHub', 'GitLab',
          'Linux', 'Nginx'
        ],
        type: 'Gap-Addressing',
        question: 'The job description calls for {gap}, which is missing from your resume. What would your 30-day ramp-up plan look like?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Acknowledge the gap honestly.',
          'Sketch a 30-day plan.',
          'Name hands-on practice you would do.',
          'Explain how you would show progress.'
        ],
        evalCriteria: 'Looks for planning discipline and hands-on learning.'
      },
      {
        id: 'ops-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: [
          'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform',
          'CI/CD', 'Jenkins', 'GitHub Actions', 'Git', 'GitHub', 'GitLab',
          'Linux', 'Nginx'
        ],
        type: 'Technical',
        question: 'This role centers on {jdSkill}, already on your resume. How would you apply it here and what would you monitor first?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Recall your {jdSkill} usage.',
          'Describe your first action here.',
          'Name the first signals you monitor.',
          'State the alerting you would add.'
        ],
        evalCriteria: 'Checks operational thinking and monitoring habits.'
      }
    ]
  },
  {
    key: 'cybersecurity',
    label: 'Security',
    resume: [
      {
        id: 'sec-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Security', 'OAuth', 'JWT'],
        type: 'Experience-Based',
        question: 'Tell me about a weakness you found or fixed using {skill}. How did you prioritize it and prove the risk was gone?',
        context: 'Probes security ownership through {skill}.',
        sampleAnswerOutline: [
          'Describe the weakness found.',
          'Explain how you prioritized it.',
          'Detail the fix you made.',
          'Show how you verified closure.'
        ],
        evalCriteria: 'Checks risk prioritization and verification of fixes.'
      }
    ],
    role: [
      {
        id: 'sec-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        skills: ['Security', 'OAuth', 'JWT'],
        type: 'Gap-Addressing',
        question: 'You are missing {gap}, a requirement in this posting. How would you learn it responsibly and prove readiness?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Own the missing skill.',
          'Describe responsible learning steps.',
          'Name evidence you would produce.',
          'Explain your timeline.'
        ],
        evalCriteria: 'Looks for responsibility, structure, and proof of readiness.'
      },
      {
        id: 'sec-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        skills: ['Security', 'OAuth', 'JWT'],
        type: 'Technical',
        question: 'You already work with {jdSkill}. How would you apply it in this environment, and what would you audit on day one?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Map {jdSkill} to this environment.',
          'Describe your day-one audit.',
          'Name the highest risk you check.',
          'State how you would report findings.'
        ],
        evalCriteria: 'Checks security posture and audit thinking.'
      }
    ]
  },
  {
    key: 'blockchain',
    label: 'Blockchain & Web3',
    resume: [
      {
        id: 'bc-res',
        anchor: 'skill',
        difficulty: 'Mid',
        base: 82,
        keywords: ['blockchain', 'web3', 'solidity', 'smart contract', 'ethereum'],
        type: 'Project-Based',
        question: 'Walk through a system you built with {skill}. What did you decentralize, and what did that trade cost in speed or complexity?',
        context: 'Probes decentralization trade-offs in your {skill} work.',
        sampleAnswerOutline: [
          'Describe the system built.',
          'Explain what you decentralized.',
          'Detail the cost of that trade.',
          'Share what you would rethink.'
        ],
        evalCriteria: 'Checks understanding of decentralization trade-offs.'
      }
    ],
    role: [
      {
        id: 'bc-gap',
        anchor: 'gap',
        difficulty: 'Mid',
        base: 88,
        keywords: ['blockchain', 'web3', 'solidity', 'smart contract', 'ethereum'],
        type: 'Gap-Addressing',
        question: 'The posting wants {gap}, which you have not worked with. How would you go from zero to contributing with it?',
        context: 'Addresses the {gap} requirement missing from your resume.',
        sampleAnswerOutline: [
          'Acknowledge the gap.',
          'Plan your learning path.',
          'Name a first contribution.',
          'Explain how you would prove skill.'
        ],
        evalCriteria: 'Looks for initiative and a route to first contribution.'
      },
      {
        id: 'bc-req',
        anchor: 'jdSkill',
        difficulty: 'Mid',
        base: 82,
        keywords: ['blockchain', 'web3', 'solidity', 'smart contract', 'ethereum'],
        type: 'Technical',
        question: 'The role uses {jdSkill} and your resume shows it. How would you contribute with it from the first sprint?',
        context: 'Covers the {jdSkill} requirement you already evidence.',
        sampleAnswerOutline: [
          'Cite your {jdSkill} experience.',
          'Propose a first-sprint contribution.',
          'Name a risk you would watch.',
          'State how you would measure impact.'
        ],
        evalCriteria: 'Checks early contribution value and risk awareness.'
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Flattened entry indexes (built once at module load; duplicate ids throw).
// ---------------------------------------------------------------------------

const RESUME_ENTRIES = [];
const ROLE_ENTRIES = [];
const ALL_ENTRY_IDS = new Set();
let nextBankIndex = 0;

for (const group of QUESTION_BANK) {
  const sides = [
    ['resume', RESUME_ENTRIES, group.resume || []],
    ['role', ROLE_ENTRIES, group.role || []]
  ];
  for (const [side, target, entries] of sides) {
    for (const entry of entries) {
      if (ALL_ENTRY_IDS.has(entry.id)) {
        throw new Error(`question bank duplicate id: ${entry.id}`);
      }
      ALL_ENTRY_IDS.add(entry.id);
      target.push({
        ...entry,
        side,
        category: group.key,
        categoryLabel: group.label,
        bankIndex: nextBankIndex++
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Candidate instances
// ---------------------------------------------------------------------------

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function makeInstance(entry, value, slots, sourceText, opts = {}) {
  const text = String(sourceText || '');
  const fallback = text.length + entry.bankIndex;
  const position = value === null ? fallback : positionOf(text, value);
  return {
    entry,
    value: value === null ? null : String(value),
    slots,
    prominence: opts.prominence || 0,
    keyword: Boolean(opts.keyword),
    sourceOrder: position >= 0 ? position : fallback,
    tokens: tokenize(fillTemplate(entry.question, slots))
  };
}

function resumeInstances(entries, ctx) {
  const { resumeText, evidence, skillMeta } = ctx;
  const evidenced = evidence.skills || [];
  const instances = [];
  for (const entry of entries) {
    if (entry.anchor === 'project') {
      for (const project of evidence.projects || []) {
        const name = String(project.name || '').trim();
        if (name) instances.push(makeInstance(entry, name, { project: name }, resumeText));
      }
      continue;
    }
    if (entry.anchor === 'experience') {
      for (const exp of evidence.experience || []) {
        const value = String(exp.company || exp.role || '').trim();
        if (!value) continue;
        const slots = { company: String(exp.company || '').trim() || 'your previous team', role: String(exp.role || '').trim() || 'engineer' };
        instances.push(makeInstance(entry, value, slots, resumeText));
      }
      continue;
    }
    if (entry.anchor === 'education') {
      for (const item of evidence.education || []) {
        const value = String(item || '').trim();
        if (value) instances.push(makeInstance(entry, value, { education: value }, resumeText));
      }
      continue;
    }
    if (entry.anchor === 'certification') {
      for (const item of evidence.certifications || []) {
        const value = String(item || '').trim();
        if (value) instances.push(makeInstance(entry, value, { certification: value }, resumeText));
      }
      continue;
    }
    if (entry.anchor === 'skill') {
      let skillNames = [];
      if (entry.skills) {
        skillNames = evidenced.filter((name) => entry.skills.includes(name));
      } else if (!entry.keywords) {
        skillNames = evidenced;
      }
      for (const name of skillNames) {
        const count = skillMeta.get(name)?.count ?? countWord(resumeText, name);
        instances.push(makeInstance(entry, name, { skill: name }, resumeText, {
          prominence: Math.min(PROMINENCE_CAP, count)
        }));
      }
      for (const keyword of entry.keywords || []) {
        const count = countWord(resumeText, keyword);
        if (count <= 0) continue;
        instances.push(makeInstance(entry, keyword, { skill: keyword }, resumeText, {
          prominence: Math.min(PROMINENCE_CAP, count),
          keyword: true
        }));
      }
      continue;
    }
    if (entry.anchor === 'none') {
      instances.push(makeInstance(entry, null, {}, resumeText));
    }
  }
  return instances;
}

function roleInstances(entries, ctx) {
  const { jobDescription, requirements, evidence, jobTitle } = ctx;
  const evidenced = new Set((evidence.skills || []).map((name) => name.toLowerCase()));
  const instances = [];
  for (const entry of entries) {
    if (entry.anchor === 'gap') {
      let targets = [];
      if (entry.skills) {
        targets = requirements.filter((req) => entry.skills.includes(req.name) && !evidenced.has(req.name.toLowerCase()));
      } else if (!entry.keywords) {
        targets = requirements.filter((req) => !evidenced.has(req.name.toLowerCase()));
      }
      for (const req of targets) {
        instances.push(makeInstance(entry, req.name, { gap: req.name }, jobDescription, {
          prominence: Math.min(PROMINENCE_CAP, req.count || countWord(jobDescription, req.name))
        }));
      }
      for (const keyword of entry.keywords || []) {
        if (countWord(resumeTextOf(ctx), keyword) > 0) continue;
        const count = countWord(jobDescription, keyword);
        if (count <= 0) continue;
        instances.push(makeInstance(entry, keyword, { gap: keyword }, jobDescription, {
          prominence: Math.min(PROMINENCE_CAP, count),
          keyword: true
        }));
      }
      continue;
    }
    if (entry.anchor === 'jdSkill') {
      let targets = [];
      if (entry.skills) {
        targets = requirements.filter((req) => entry.skills.includes(req.name) && evidenced.has(req.name.toLowerCase()));
      } else if (!entry.keywords) {
        targets = requirements.filter((req) => evidenced.has(req.name.toLowerCase()));
      }
      for (const req of targets) {
        instances.push(makeInstance(entry, req.name, { jdSkill: req.name }, jobDescription, {
          prominence: Math.min(PROMINENCE_CAP, req.count || countWord(jobDescription, req.name))
        }));
      }
      for (const keyword of entry.keywords || []) {
        if (countWord(resumeTextOf(ctx), keyword) <= 0) continue;
        const count = countWord(jobDescription, keyword);
        if (count <= 0) continue;
        instances.push(makeInstance(entry, keyword, { jdSkill: keyword }, jobDescription, {
          prominence: Math.min(PROMINENCE_CAP, count),
          keyword: true
        }));
      }
      continue;
    }
    if (entry.anchor === 'jobTitle') {
      instances.push(makeInstance(entry, jobTitle, { jobTitle }, jobDescription));
      continue;
    }
    if (entry.anchor === 'none') {
      instances.push(makeInstance(entry, null, {}, jobDescription));
    }
  }
  return instances;
}

function resumeTextOf(ctx) {
  return ctx.resumeText || '';
}

// ---------------------------------------------------------------------------
// Scoring and greedy selection
// ---------------------------------------------------------------------------

function scoreInstance(instance, picked, ctx) {
  const { entry } = instance;
  const base = entry.base ?? ANCHOR_BASE[entry.anchor] ?? 0;
  let score = base;
  score += Math.min(PROMINENCE_CAP, instance.prominence);
  score += difficultyBonus(entry.difficulty, ctx.difficulty);
  if (instance.keyword) score += KEYWORD_HIT_BONUS;
  if (picked.length > 0) {
    const usedCategories = new Set(picked.map((item) => item.entry.category));
    score += usedCategories.has(entry.category) ? -CATEGORY_REPEAT_PENALTY : CATEGORY_NEW_BONUS;
    const usedAnchors = new Set(picked.map((item) => item.entry.anchor));
    if (usedAnchors.has(entry.anchor)) score -= ANCHOR_REPEAT_PENALTY;
  }
  return score;
}

function compareCandidates(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.sourceOrder !== b.sourceOrder) return a.sourceOrder - b.sourceOrder;
  if (a.tiebreak !== b.tiebreak) return a.tiebreak < b.tiebreak ? -1 : 1;
  return a.entry.bankIndex - b.entry.bankIndex;
}

function selectInstances(candidates, count, ctx) {
  const picked = [];
  const usedEntries = new Set();
  const usedValues = new Set();
  const pickedTokens = [];
  for (let step = 0; step < count; step += 1) {
    const pool = candidates.filter((candidate) =>
      !usedEntries.has(candidate.entry.id) &&
      (candidate.value === null || !usedValues.has(normalizeValue(candidate.value)))
    );
    if (pool.length === 0) break;
    const scored = pool.map((candidate) => ({
      ...candidate,
      score: scoreInstance(candidate, picked, ctx),
      tiebreak: hashTiebreak(ctx.seed, candidate.entry.id, candidate.value)
    }));
    scored.sort(compareCandidates);
    const choice = scored.find((candidate) =>
      pickedTokens.every((tokens) => jaccard(candidate.tokens, tokens) < NEAR_DUP_JACCARD)
    ) || scored[0];
    picked.push(choice);
    pickedTokens.push(choice.tokens);
    usedEntries.add(choice.entry.id);
    if (choice.value !== null) usedValues.add(normalizeValue(choice.value));
  }
  return picked;
}

function materialize(picks) {
  return picks.map((pick) => ({
    type: pick.entry.type,
    question: fillTemplate(pick.entry.question, pick.slots),
    context: fillTemplate(pick.entry.context, pick.slots),
    sampleAnswerOutline: pick.entry.sampleAnswerOutline.map((bullet) => fillTemplate(bullet, pick.slots)),
    evalCriteria: fillTemplate(pick.entry.evalCriteria, pick.slots)
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select resume-based and role-based questions from the curated bank.
 * All inputs are optional; missing evidence simply removes candidates, and
 * the generic entries guarantee both lists can always be filled.
 */
export function selectInterviewQuestions({
  resumeText = '',
  jobDescription = '',
  evidence = {},
  skillMeta = new Map(),
  jobInfo = {},
  difficulty = 'Mid',
  resumeCount = 3,
  roleCount = 2
} = {}) {
  const safeEvidence = {
    skills: evidence.skills || [],
    projects: evidence.projects || [],
    experience: evidence.experience || [],
    education: evidence.education || [],
    certifications: evidence.certifications || []
  };
  const seed = createHash('sha256')
    .update([resumeText, jobDescription, difficulty].join('\u0000'))
    .digest('hex')
    .slice(0, 16);
  const ctx = {
    resumeText,
    jobDescription,
    evidence: safeEvidence,
    skillMeta,
    requirements: jobInfo.requirements || [],
    jobTitle: inferJobTitle(jobDescription),
    difficulty,
    seed
  };
  const resumePicks = selectInstances(resumeInstances(RESUME_ENTRIES, ctx), resumeCount, ctx);
  const rolePicks = selectInstances(roleInstances(ROLE_ENTRIES, ctx), roleCount, ctx);
  return {
    resumeBasedQuestions: materialize(resumePicks),
    roleBasedQuestions: materialize(rolePicks)
  };
}

/** Bank inventory (groups and per-side entry counts) for tests and docs. */
export function questionBankSizes() {
  return {
    groups: QUESTION_BANK.length,
    resumeEntries: RESUME_ENTRIES.length,
    roleEntries: ROLE_ENTRIES.length
  };
}
