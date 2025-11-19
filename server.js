// server.js
require("dotenv").config();

const PDFDocument = require("pdfkit");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // v2
const pdfParse = require("pdf-parse");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

// ---------------- MongoDB ----------------
const MONGO_URI = process.env.MONGO_URI || "";
if (!MONGO_URI) {
  console.warn("MONGO_URI not set in .env – tracker features will fail.");
}

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    jobTitle: String,
    company: String,
    jobUrl: String,
    matchScore: Number,
    status: {
      type: String,
      enum: ["saved", "applied", "interview", "offer", "rejected"],
      default: "saved"
    },
    notes: String
  },
  { timestamps: true }
);
const Application = mongoose.model("Application", applicationSchema);

// ---------------- Upload folder ----------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));
app.use(express.static("public"));

/* --------------------------------------------------
 *  Basic NLP helpers + skill dictionary
 * -------------------------------------------------- */

const stopwords = new Set(
  [
    "the",
    "and",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
    "at",
    "by",
    "from",
    "is",
    "are",
    "was",
    "were",
    "be",
    "this",
    "that",
    "as",
    "it",
    "or",
    "you",
    "your",
    "we",
    "our",
    "they",
    "their",
    "i",
    "have",
    "has",
    "will",
    "can",
    "should",
    "include",
    "including",
    "job",
    "role",
    "position",
    "responsibilities",
    "requirements",
    "skills"
  ].map((w) => w.toLowerCase())
);

const skillDictionary = {
  javascript: ["javascript", "js", "java script"],
  typescript: ["typescript", "ts"],
  react: ["react", "reactjs", "react.js", "react js"],
  nextjs: ["nextjs", "next.js", "next js"],
  "node.js": ["node", "nodejs", "node.js", "node js"],
  express: ["express", "expressjs", "express.js", "express js"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  tailwind: ["tailwind", "tailwindcss", "tailwind css"],
  bootstrap: ["bootstrap"],
  java: ["java"],
  "spring boot": ["spring boot", "spring-boot", "springboot"],
  python: ["python"],
  django: ["django"],
  flask: ["flask"],
  kotlin: ["kotlin"],
  android: ["android", "android studio"],
  "react native": ["react native", "react-native"],
  sql: ["sql", "structured query language"],
  mysql: ["mysql", "my sql", "my-sql"],
  postgresql: [
    "postgresql",
    "postgres",
    "postgre sql",
    "postgre-sql",
    "postgreSQL"
  ],
  mongodb: ["mongodb", "mongo db", "mongo-db", "mongo"],
  firebase: ["firebase"],
  redis: ["redis"],
  aws: ["aws", "amazon web services"],
  azure: ["azure", "microsoft azure"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  git: ["git"],
  github: ["github"],
  jira: ["jira"],
  jenkins: ["jenkins"],
  "rest api": ["rest", "rest api", "restful api", "restful services"],
  graphql: ["graphql"],
  microservices: ["microservices", "micro-service", "micro services"],
  "machine learning": ["machine learning", "ml"],
  "data analysis": ["data analysis", "data analytics", "analyst"],
  excel: ["excel", "ms excel"],
  powerbi: ["power bi", "powerbi"],
  tableau: ["tableau"],
  figma: ["figma"],
  "ui/ux": ["ui/ux", "ui ux", "user interface", "user experience"]
};

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopwords.has(w));
}

function extractSkills(text) {
  const lower = text.toLowerCase();
  const found = new Set();

  for (const [canonical, variants] of Object.entries(skillDictionary)) {
    for (const variant of variants) {
      const pattern = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${pattern}\\b`, "i");
      if (regex.test(lower)) {
        found.add(canonical);
        break;
      }
    }
  }

  const tokens = tokenize(text);
  const counts = {};
  for (const t of tokens) counts[t] = (counts[t] || 0) + 1;
  const keywords = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w)
    .filter((w) => w.length > 3);

  return {
    skills: Array.from(found),
    keywords
  };
}

function intersect(a, b) {
  const bSet = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => bSet.has(x.toLowerCase()));
}
function difference(a, b) {
  const bSet = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => !bSet.has(x.toLowerCase()));
}

function buildAnalysis({
  resumeText,
  jobText,
  resumeSkills,
  jobSkills,
  pageTitle,
  jobUrl
}) {
  const commonSkills = intersect(resumeSkills.skills, jobSkills.skills);
  const missingSkills = difference(jobSkills.skills, resumeSkills.skills);
  const extraSkills = difference(resumeSkills.skills, jobSkills.skills);

  const jobSkillCount = jobSkills.skills.length || 1;
  const commonRatio = commonSkills.length / jobSkillCount;
  const missingRatio = missingSkills.length / jobSkillCount;

  let matchScore =
    (commonRatio * 0.75 + (1 - missingRatio) * 0.25) * 100;
  matchScore = Math.max(0, Math.min(100, Math.round(matchScore)));

  const highMatch = matchScore >= 80;
  const mediumMatch = matchScore >= 60 && matchScore < 80;
  let summary;
  if (highMatch) {
    summary =
      "This looks like a strong match. Your resume already mentions many key skills required for this job.";
  } else if (mediumMatch) {
    summary =
      "This looks like a decent match. You match several important skills, but there are some gaps you may want to close before applying.";
  } else {
    summary =
      "This seems like a weak match right now. You might still apply if you really like the role, but you should expect competition and consider upskilling first.";
  }

  const recommendations = [];
  if (missingSkills.length > 0) {
    recommendations.push(
      "Consider adding or emphasizing these skills if you actually have them: " +
        missingSkills.slice(0, 12).join(", ") +
        "."
    );
  }
  if (extraSkills.length > 0) {
    recommendations.push(
      "Your resume highlights these skills that are not mentioned strongly in the job description: " +
        extraSkills.slice(0, 10).join(", ") +
        ". If space is tight, you might reduce focus on them for this particular application."
    );
  }
  if (jobSkills.keywords.length > 0) {
    recommendations.push(
      "Try to mirror some of the important keywords from the job description (ATS friendly), for example: " +
        jobSkills.keywords.slice(0, 10).join(", ") +
        "."
    );
  }

  let jobTitle = "";
  let company = "";
  if (pageTitle) {
    const parts = pageTitle.split(/[-|·]/).map((p) => p.trim());
    if (parts.length >= 1) jobTitle = parts[0];
    if (parts.length >= 2) company = parts[1];
  }

  return {
    appName: "ApplyEasy",
    jobTitle: jobTitle || "Job",
    company,
    jobUrl,
    matchScore,
    summary,
    recommendations,
    commonSkills,
    missingSkills,
    extraSkills,
    jobSnippet: jobText.slice(0, 600),
    resumeSnippet: resumeText.slice(0, 600),
    fullJobText: jobText.slice(0, 8000),
    fullResumeText: resumeText.slice(0, 8000)
  };
}

/* --------------------------------------------------
 *  Helper: call Gemini (JSON-only)
 * -------------------------------------------------- */

async function callGeminiJSON(prompt, model = DEFAULT_GEMINI_MODEL) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini error:", errText);
    throw new Error("Gemini API error");
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}

/* --------------------------------------------------
 *  /api/analyze – resume vs job text, skill match
 * -------------------------------------------------- */

app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { jobUrl = "", jobDescription = "" } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a resume file." });
    }

    let resumeText = "";
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    try {
      if (ext === ".pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        resumeText = pdfData.text;
      } else {
        resumeText = fs.readFileSync(filePath, "utf8");
      }
    } catch (err) {
      console.error("Error reading resume:", err);
      resumeText = "";
    } finally {
      fs.unlink(filePath, () => {});
    }

    if (!resumeText.trim()) {
      return res.status(400).json({
        error:
          "Could not read text from resume. Try uploading a .txt or simple .pdf."
      });
    }

    let jobText = jobDescription;
    let pageTitle = "";

    if (!jobText && jobUrl) {
      try {
        const response = await fetch(jobUrl);
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch) pageTitle = titleMatch[1];

        jobText = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ");
      } catch (err) {
        console.error("Error fetching job URL:", err);
      }
    }

    if (!jobText.trim()) {
      return res.status(400).json({
        error:
          "Could not read job description from the URL. Please paste the job description text instead."
      });
    }

    const resumeSkills = extractSkills(resumeText);
    const jobSkills = extractSkills(jobText);
    const analysis = buildAnalysis({
      resumeText,
      jobText,
      resumeSkills,
      jobSkills,
      pageTitle,
      jobUrl
    });

    res.json(analysis);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
});

/* --------------------------------------------------
 *  AI: Resume guide
 * -------------------------------------------------- */

app.post("/api/ai/resume-guide", async (req, res) => {
  try {
    const { resumeText, jobText } = req.body || {};
    if (!resumeText || !jobText) {
      return res
        .status(400)
        .json({ error: "Missing resumeText or jobText in request." });
    }

    const truncatedResume = String(resumeText).slice(0, 6000);
    const truncatedJob = String(jobText).slice(0, 4000);

    const prompt = `
You are an expert ATS-friendly resume coach for software / tech roles.
You receive the candidate's resume text and a job description.

1. First, analyse what is missing or weak in the resume relative to the JD (skills, technologies, impact, metrics).
2. Then suggest concrete changes: what to add, what to rephrase, what to remove.
3. Propose 3–5 new bullet points tailored to this JD that the candidate could add under their best project or experience.
4. Propose a 1-line headline/summary they can put at the top of their resume.

Return ONLY valid JSON in this exact format:
{
  "resumeTips": ["...", "..."],
  "newBullets": ["...", "..."],
  "newHeadline": "..."
}

RESUME:
${truncatedResume}

JOB DESCRIPTION:
${truncatedJob}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from resume-guide:", err);
      parsed = {
        resumeTips: [content],
        newBullets: [],
        newHeadline: ""
      };
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "AI resume guide failed. Please try again later." });
  }
});

/* --------------------------------------------------
 *  AI: Interview questions
 * -------------------------------------------------- */

app.post("/api/ai/interview/questions", async (req, res) => {
  try {
    const { jobText, resumeText } = req.body || {};
    if (!jobText) {
      return res.status(400).json({ error: "jobText is required." });
    }

    const truncatedJob = String(jobText).slice(0, 3500);
    const truncatedResume = String(resumeText || "").slice(0, 3500);

    const prompt = `
You are an experienced interviewer for software / tech roles.

You will create an interview question set based on the job description
(and optionally the candidate's resume).

Return ONLY JSON in this format:
{
  "technical": ["question1", "question2", ...],
  "project": ["question1", "question2"],
  "behavioral": ["question1", "question2"],
  "company": ["question1"]
}

JOB DESCRIPTION:
${truncatedJob}

RESUME (optional, may be empty):
${truncatedResume}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from interview/questions:", err);
      return res
        .status(500)
        .json({ error: "Failed to parse AI questions. Try again." });
    }

    const allQuestions = [
      ...(parsed.technical || []),
      ...(parsed.project || []),
      ...(parsed.behavioral || []),
      ...(parsed.company || [])
    ].filter(Boolean);

    res.json({
      groups: parsed,
      questions: allQuestions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "AI interview questions failed. Please try again."
    });
  }
});

/* --------------------------------------------------
 *  AI: Interview feedback
 * -------------------------------------------------- */

app.post("/api/ai/interview/feedback", async (req, res) => {
  try {
    const { question, answer, jobText, resumeText } = req.body || {};
    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: "question and answer are required." });
    }

    const truncatedJob = String(jobText || "").slice(0, 2500);
    const truncatedResume = String(resumeText || "").slice(0, 2500);
    const truncatedAnswer = String(answer).slice(0, 2000);

    const prompt = `
You are a strict but encouraging interview coach.

You get:
- A job description (might be short).
- The candidate's resume (optional).
- One interview question.
- The candidate's spoken answer (transcript).

You must:
1. Rate the answer from 1–10.
2. Give a 1-line overall comment.
3. Provide 3–5 bullet tips on how to improve (structure, clarity, STAR, impact, technologies).
4. Optionally suggest a stronger "improvedAnswer" version (but do NOT invent fake experience).

Return ONLY JSON in this exact format:
{
  "score": 0,
  "overall": "short phrase",
  "tips": ["...", "..."],
  "improvedAnswer": "..."
}

JOB DESCRIPTION:
${truncatedJob}

RESUME:
${truncatedResume}

QUESTION:
${question}

ANSWER:
${truncatedAnswer}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from interview/feedback:", err);
      parsed = {
        score: 0,
        overall:
          "Could not parse AI feedback, but here is the raw text.",
        tips: [content],
        improvedAnswer: ""
      };
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "AI interview feedback failed. Please try again."
    });
  }
});

/* --------------------------------------------------
 *  AI: Cover letter
 * -------------------------------------------------- */

app.post("/api/ai/cover-letter", async (req, res) => {
  try {
    const {
      resumeText,
      jobText,
      jobTitle = "",
      companyName = "",
      applicantName = ""
    } = req.body || {};

    if (!resumeText || !jobText) {
      return res.status(400).json({
        error: "resumeText and jobText are required."
      });
    }

    const truncatedResume = String(resumeText).slice(0, 6000);
    const truncatedJob = String(jobText).slice(0, 4000);

    const prompt = `
You are a professional cover letter writer for software/tech roles.

Write a concise, ATS-friendly cover letter tailored to this specific job.
Use a confident but humble tone. Use 3–5 short paragraphs.

Personalize it using:
- Candidate name (if provided),
- Job title,
- Company name,
- Relevant skills and projects from the resume.

Return ONLY valid JSON in this format:
{
  "coverLetter": "full cover letter text with line breaks"
}

If the candidate name or company name are empty, just write "Dear Hiring Manager," and avoid guessing.

RESUME:
${truncatedResume}

JOB DESCRIPTION:
${truncatedJob}

JOB TITLE: ${jobTitle}
COMPANY: ${companyName}
CANDIDATE NAME: ${applicantName}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from cover-letter:", err);
      parsed = { coverLetter: content };
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "AI cover letter generation failed. Please try again." });
  }
});

/* --------------------------------------------------
 *  AI: Mentor chat
 * -------------------------------------------------- */

app.post("/api/ai/mentor-chat", async (req, res) => {
  try {
    const { message, resumeText = "", jobText = "" } = req.body || {};
    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ error: "message is required for mentor chat." });
    }

    const truncatedResume = String(resumeText).slice(0, 4000);
    const truncatedJob = String(jobText).slice(0, 4000);
    const userQuestion = String(message).slice(0, 1000);

    const prompt = `
You are "ApplyEasy Mentor" – a friendly but clear tech career coach.

Context:
- Candidate resume text (may be empty):
${truncatedResume}

- Job description text (may be empty):
${truncatedJob}

User's question:
${userQuestion}

Please answer in 2–4 short paragraphs or bullet points.
Be specific and actionable (mention skills, DSA topics, project ideas, interview focus, etc.).
Do NOT invent fake experience for the user.

Return ONLY valid JSON in this exact format:
{
  "reply": "your detailed guidance here"
}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from mentor-chat:", err);
      parsed = { reply: content };
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "AI mentor chat failed. Please try again." });
  }
});

/* --------------------------------------------------
 *  AI: LinkedIn profile optimizer
 * -------------------------------------------------- */

app.post("/api/ai/linkedin-profile", async (req, res) => {
  try {
    const {
      resumeText = "",
      jobText = "",
      targetRole = "",
      tone = "default"
    } = req.body || {};

    const prompt = `
You are an expert at writing LinkedIn "About" sections and profile headlines for software/tech roles.

You receive:
- Candidate resume text
- (Optional) Job description / target industry
- Target role
- Desired tone: ${tone} (options: "default", "student", "experienced", "casual")

Create:
1) A 3–5 paragraph LinkedIn "About" section optimized with relevant keywords, but still human and natural.
2) 5 short, punchy LinkedIn headline ideas (no more than 220 characters each).

Return ONLY valid JSON in this format:
{
  "about": "full about section",
  "headlines": ["headline 1", "headline 2", "..."]
}

RESUME:
${String(resumeText).slice(0, 6000)}

JOB DESCRIPTION / CONTEXT:
${String(jobText).slice(0, 4000)}

TARGET ROLE:
${targetRole}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from linkedin-profile:", err);
      parsed = { about: content, headlines: [] };
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "AI LinkedIn optimizer failed. Please try again later."
    });
  }
});

/* --------------------------------------------------
 *  AI: Resume builder
 * -------------------------------------------------- */

app.post("/api/ai/resume-builder", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      location,
      role,
      level,
      skills,
      projects,
      achievements
    } = req.body || {};

    if (!fullName || !role) {
      return res
        .status(400)
        .json({ error: "fullName and role are required." });
    }

    const prompt = `
You are an expert resume writer for early-career software/tech candidates.

Build a clean, ATS-friendly one-page resume in plain text using these details:

Name: ${fullName}
Email: ${email}
Phone: ${phone}
Location: ${location}
Target Role: ${role}
Experience Level: ${level}
Skills (raw input): ${skills}
Projects (raw input): ${projects}
Achievements / extras (raw input): ${achievements}

Rules:
- Use clear section headings like: SUMMARY, SKILLS, PROJECTS, EXPERIENCE (if applicable), EDUCATION, EXTRA.
- Rewrite skills, projects, achievements into strong bullet points with impact and metrics where reasonable.
- Do NOT invent fake companies or degrees. If something is missing, just skip that section.
- Use concise, modern formatting suitable for copy-paste into Docs/Word.

Return ONLY valid JSON in this format:
{
  "resumeText": "full resume as plain text"
}
`;

    const content = await callGeminiJSON(prompt);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from resume-builder:", err);
      parsed = { resumeText: content };
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "AI resume builder failed. Please try again later."
    });
  }
});

/* --------------------------------------------------
 *  Tracker API (Mongo-backed Kanban)
 * -------------------------------------------------- */

app.get("/api/tracker/jobs", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }
    const jobs = await Application.find({ userId }).sort({ createdAt: -1 });
    res.json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load tracker jobs." });
  }
});

app.post("/api/tracker/jobs", async (req, res) => {
  try {
    const { userId, jobTitle, company, jobUrl, matchScore, status } =
      req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }
    const job = await Application.create({
      userId,
      jobTitle,
      company,
      jobUrl,
      matchScore,
      status: status || "saved"
    });
    res.status(201).json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save tracker job." });
  }
});

app.patch("/api/tracker/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const job = await Application.findByIdAndUpdate(id, updates, {
      new: true
    });
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    res.json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update tracker job." });
  }
});

app.delete("/api/tracker/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Application.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete tracker job." });
  }
});

/* --------------------------------------------------
 *  Start server
 * -------------------------------------------------- */
/* --------------------------------------------------
 *  /api/resume-pdf – Generate structured resume PDF
 * -------------------------------------------------- */

app.post("/api/resume-pdf", (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      linkedin,
      github,
      summary,
      education,
      skillsLanguages,
      skillsFrameworks,
      skillsDatabases,
      skillsTools,
      project1Title,
      project1Desc,
      project1Tech,
      project2Title,
      project2Desc,
      project2Tech,
      certs,
      extras
    } = req.body || {};

    // Stream PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="ApplyEasy_Resume.pdf"'
    );

    const doc = new PDFDocument({ size: "A4", margin: 45 });
    doc.pipe(res);

    // ---------- HEADER ----------
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(name || "Your Name", { align: "center" });

    doc.moveDown(0.3);

    const contactLine = [
      phone || "",
      email || "",
      linkedin || "",
      github || ""
    ]
      .filter(Boolean)
      .join("  |  ");

    if (contactLine) {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .text(contactLine, { align: "center" });
      doc.moveDown(0.8);
    }

    const drawSection = (title) => {
      const width =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#000000")
        .text(title.toUpperCase(), {
          align: "left"
        });

      const y = doc.y + 1;
      doc
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + width, y)
        .lineWidth(0.5)
        .strokeColor("#555555")
        .stroke();

      doc.moveDown(0.5);
    };

    // ---------- PROFILE ----------
    if (summary) {
      drawSection("Profile");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#111111")
        .text(summary, {
          align: "justify"
        });
      doc.moveDown(0.8);
    }

    // ---------- EDUCATION ----------
    if (education) {
      drawSection("Education");
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(education, { align: "left" });
      doc.moveDown(0.8);
    }

    // ---------- SKILLS ----------
    const skillLines = [];
    if (skillsLanguages)
      skillLines.push(`Programming Languages: ${skillsLanguages}`);
    if (skillsFrameworks)
      skillLines.push(`Frameworks / Stack: ${skillsFrameworks}`);
    if (skillsDatabases)
      skillLines.push(`Databases: ${skillsDatabases}`);
    if (skillsTools)
      skillLines.push(`Tools / Others: ${skillsTools}`);

    if (skillLines.length) {
      drawSection("Technical Skills");
      doc.font("Helvetica").fontSize(10);
      skillLines.forEach((line) => {
        doc.text("• " + line);
      });
      doc.moveDown(0.8);
    }

    // ---------- PROJECTS ----------
    const projects = [];
    if (project1Title || project1Desc || project1Tech) {
      projects.push({
        title: project1Title,
        desc: project1Desc,
        tech: project1Tech
      });
    }
    if (project2Title || project2Desc || project2Tech) {
      projects.push({
        title: project2Title,
        desc: project2Desc,
        tech: project2Tech
      });
    }

    if (projects.length) {
      drawSection("Projects");
      projects.forEach((p) => {
        if (!p.title && !p.desc) return;

        doc
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .fillColor("#000000")
          .text(p.title || "Project", { align: "left" });

        if (p.tech) {
          doc
            .font("Helvetica-Oblique")
            .fontSize(9)
            .fillColor("#444444")
            .text(p.tech);
        }

        if (p.desc) {
          doc
            .moveDown(0.1)
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#111111")
            .text(p.desc, { align: "justify" });
        }

        doc.moveDown(0.6);
      });
    }

    // ---------- CERTIFICATIONS ----------
    if (certs) {
      drawSection("Certifications");
      const lines = String(certs).split("\n");
      doc.font("Helvetica").fontSize(10);
      lines.forEach((line) => {
        const t = line.trim();
        if (!t) return;
        doc.text("• " + t);
      });
      doc.moveDown(0.8);
    }

    // ---------- EXTRAS ----------
    if (extras) {
      drawSection("Extracurricular / Additional");
      const lines = String(extras).split("\n");
      doc.font("Helvetica").fontSize(10);
      lines.forEach((line) => {
        const t = line.trim();
        if (!t) return;
        doc.text("• " + t);
      });
      doc.moveDown(0.8);
    }

    doc.end();
  } catch (err) {
    console.error("Resume PDF error:", err);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Failed to generate resume PDF. Try again." });
    }
  }
});

app.listen(PORT, () => {
  console.log(`ApplyEasy server running at http://localhost:${PORT}`);
});
