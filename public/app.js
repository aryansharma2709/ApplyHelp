// app.js

// ---------- Panda eye-cover behaviour ----------
const panda = document.getElementById("panda");
const passwordInput = document.getElementById("login-password");

passwordInput.addEventListener("focus", () =>
  panda.classList.add("cover-eyes")
);
passwordInput.addEventListener("input", () =>
  panda.classList.add("cover-eyes")
);
passwordInput.addEventListener("blur", () =>
  panda.classList.remove("cover-eyes")
);

// ---------- Login behaviour ----------
const loginForm = document.getElementById("login-form");
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const userNameLabel = document.getElementById("user-name-label");
const logoutBtn = document.getElementById("logout-btn");

let currentUserId = null;

// restore user (optional auto-fill)
const savedUserId = localStorage.getItem("applyeasyUserId");
if (savedUserId) {
  const loginUserInput = document.getElementById("login-username");
  if (loginUserInput) loginUserInput.value = savedUserId;
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document
    .getElementById("login-username")
    .value.trim();
  if (!username) return;
  currentUserId = username;
  localStorage.setItem("applyeasyUserId", username);
  userNameLabel.textContent = `Logged in as ${username}`;
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  loadTracker();
});

logoutBtn.addEventListener("click", () => {
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

// ---------- Global state ----------
let lastAnalysisData = null;
let interviewQuestions = [];
let currentQuestionIndex = 0;
let recognition = null;
let recognizing = false;

// ---------- Elements ----------
const analyzeForm = document.getElementById("analyze-form");
const errorBox = document.getElementById("form-error");
const loadingIndicator = document.getElementById("loading-indicator");
const resultsEmpty = document.getElementById("results-empty");
const resultsContent = document.getElementById("results-content");
const aiReadyLabel = document.getElementById("ai-ready-label");

const matchScoreEl = document.getElementById("match-score");
const scoreRing = document.getElementById("score-ring");
const jobTitleEl = document.getElementById("job-title");
const jobCompanyEl = document.getElementById("job-company");
const jobLinkEl = document.getElementById("job-link");
const matchSummaryEl = document.getElementById("match-summary");

const commonSkillsEl = document.getElementById("common-skills");
const missingSkillsEl = document.getElementById("missing-skills");
const extraSkillsEl = document.getElementById("extra-skills");
const jobSnippetEl = document.getElementById("job-snippet");
const resumeSnippetEl = document.getElementById("resume-snippet");
const recommendationsListEl = document.getElementById(
  "recommendations-list"
);

// AI Resume Coach
const aiResumeBtn = document.getElementById("ai-resume-generate");
const aiResumeLoading = document.getElementById("ai-resume-loading");
const aiResumeError = document.getElementById("ai-resume-error");
const aiResumeTipsEl = document.getElementById("ai-resume-tips");
const aiResumeBulletsEl = document.getElementById("ai-resume-bullets");
const aiResumeHeadlineEl = document.getElementById("ai-resume-headline");

// AI Interview
const aiInterviewStartBtn = document.getElementById("ai-interview-start");
const aiInterviewNextBtn = document.getElementById("ai-interview-next");
const aiInterviewRecordBtn = document.getElementById("ai-interview-record");
const aiInterviewStopBtn = document.getElementById("ai-interview-stop");
const aiInterviewStatus = document.getElementById("ai-interview-status");
const aiInterviewError = document.getElementById("ai-interview-error");
const aiQuestionText = document.getElementById("ai-question-text");
const aiAnswerText = document.getElementById("ai-answer-text");
const aiFeedbackOverall = document.getElementById("ai-feedback-overall");
const aiFeedbackTips = document.getElementById("ai-feedback-tips");
const aiFeedbackImproved = document.getElementById("ai-feedback-improved");

// Cover letter & Mentor
const generateCoverLetterBtn = document.getElementById(
  "generateCoverLetterBtn"
);
const coverLetterOutput = document.getElementById("coverLetterOutput");
const applicantNameInput = document.getElementById("applicantNameInput");

const mentorQuestionEl = document.getElementById("mentorQuestion");
const mentorAnswerEl = document.getElementById("mentorAnswer");
const askMentorBtn = document.getElementById("askMentorBtn");

// Tracker elements
const saveToTrackerBtn = document.getElementById("saveToTrackerBtn");
const trackerStatusMsg = document.getElementById("tracker-status-message");
const trackerCols = {
  saved: document.getElementById("tracker-col-saved"),
  applied: document.getElementById("tracker-col-applied"),
  interview: document.getElementById("tracker-col-interview"),
  offer: document.getElementById("tracker-col-offer"),
  rejected: document.getElementById("tracker-col-rejected")
};

// LinkedIn optimizer
const linkedinRoleInput = document.getElementById("linkedinRole");
const linkedinToneSelect = document.getElementById("linkedinTone");
const linkedinAboutOutput = document.getElementById("linkedinAboutOutput");
const linkedinHeadlinesOutput = document.getElementById(
  "linkedinHeadlinesOutput"
);
const generateLinkedInBtn =
  document.getElementById("generateLinkedInBtn");

// PDF report
const downloadReportBtn = document.getElementById("downloadReportBtn");

// Resume builder
const resumeBuilderGenerateBtn = document.getElementById(
  "resumeBuilderGenerateBtn"
);
const resumeBuilderOutput = document.getElementById("resumeBuilderOutput");
const builderNameInput = document.getElementById("builderName");

// ---------- Helpers ----------
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}
function setLoading(isLoading) {
  if (isLoading) loadingIndicator.classList.remove("hidden");
  else loadingIndicator.classList.add("hidden");
}

function renderChips(container, items, type) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const span = document.createElement("span");
    span.textContent = "Nothing found here yet.";
    span.className = "muted";
    container.appendChild(span);
    return;
  }

  items.forEach((item) => {
    const chip = document.createElement("div");
    chip.classList.add("chip");
    if (type === "good") chip.classList.add("good");
    if (type === "missing") chip.classList.add("missing");
    if (type === "extra") chip.classList.add("extra");
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function animateScore(score) {
  scoreRing.style.setProperty("--score", "0");
  matchScoreEl.textContent = "0%";

  let current = 0;
  const step = score > 0 ? Math.max(1, Math.round(score / 25)) : 1;

  const interval = setInterval(() => {
    current += step;
    if (current >= score) {
      current = score;
      clearInterval(interval);
    }
    scoreRing.style.setProperty("--score", String(current));
    matchScoreEl.textContent = `${current}%`;
  }, 20);
}

function renderResults(data) {
  lastAnalysisData = data;

  resultsEmpty.classList.add("hidden");
  resultsContent.classList.remove("hidden");

  animateScore(data.matchScore || 0);

  jobTitleEl.textContent = data.jobTitle || "Job";
  jobCompanyEl.textContent = data.company || "";
  if (data.jobUrl) {
    jobLinkEl.href = data.jobUrl;
    jobLinkEl.style.display = "inline-block";
  } else {
    jobLinkEl.style.display = "none";
  }

  matchSummaryEl.textContent = data.summary || "";

  renderChips(commonSkillsEl, data.commonSkills, "good");
  renderChips(missingSkillsEl, data.missingSkills, "missing");
  renderChips(extraSkillsEl, data.extraSkills, "extra");

  jobSnippetEl.textContent =
    data.jobSnippet || "No job description snippet available.";
  resumeSnippetEl.textContent =
    data.resumeSnippet || "No resume snippet available.";

  recommendationsListEl.innerHTML = "";
  if (data.recommendations && data.recommendations.length) {
    data.recommendations.forEach((rec) => {
      const li = document.createElement("li");
      li.textContent = rec;
      recommendationsListEl.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent =
      "No specific suggestions — your resume already looks quite aligned!";
    recommendationsListEl.appendChild(li);
  }

  aiReadyLabel.textContent =
    "AI Resume Coach, AI Interview, Cover Letter & Mentor are now using this JD and resume.";
}

// ---------- Analyse form submission ----------
analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const resumeFile = document.getElementById("resume-file").files[0];
  const jobUrl = document.getElementById("job-url").value.trim();
  const jobDesc = document.getElementById("job-desc").value.trim();

  if (!resumeFile) {
    showError("Please upload a resume file first.");
    return;
  }

  if (!jobUrl && !jobDesc) {
    showError(
      "Please provide either a job link OR paste the job description text."
    );
    return;
  }

  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("jobUrl", jobUrl);
  formData.append("jobDescription", jobDesc);

  setLoading(true);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          "Something went wrong. Please try again with different inputs."
      );
    }

    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error(err);
    if (err.name === "AbortError") {
      showError(
        "The analysis took too long. Some job sites block automatic fetching. Try pasting the job description text instead."
      );
    } else {
      showError(err.message);
    }
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
  }
});

// ---------- AI Resume Coach ----------
function setAiResumeLoading(loading) {
  if (loading) aiResumeLoading.classList.remove("hidden");
  else aiResumeLoading.classList.add("hidden");
}
function showAiResumeError(msg) {
  aiResumeError.textContent = msg;
  aiResumeError.classList.remove("hidden");
}
function clearAiResumeError() {
  aiResumeError.textContent = "";
  aiResumeError.classList.add("hidden");
}

aiResumeBtn.addEventListener("click", async () => {
  clearAiResumeError();
  if (!lastAnalysisData) {
    showAiResumeError("Run a match analysis first.");
    return;
  }

  const resumeText =
    lastAnalysisData.fullResumeText || lastAnalysisData.resumeSnippet;
  const jobText =
    lastAnalysisData.fullJobText || lastAnalysisData.jobSnippet;

  if (!resumeText || !jobText) {
    showAiResumeError(
      "Missing resume/job text. Try running the analysis again."
    );
    return;
  }

  setAiResumeLoading(true);

  try {
    const res = await fetch("/api/ai/resume-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jobText })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.error || "AI resume guidance failed. Please try again."
      );
    }

    const data = await res.json();

    aiResumeTipsEl.innerHTML = "";
    (data.resumeTips || []).forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      aiResumeTipsEl.appendChild(li);
    });

    aiResumeBulletsEl.innerHTML = "";
    (data.newBullets || []).forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      aiResumeBulletsEl.appendChild(li);
    });

    aiResumeHeadlineEl.textContent = data.newHeadline || "";
  } catch (err) {
    console.error(err);
    showAiResumeError(err.message);
  } finally {
    setAiResumeLoading(false);
  }
});

// ---------- AI Interview (voice) ----------
function initSpeechRecognition() {
  if (recognition) return recognition;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    aiInterviewError.textContent =
      "Your browser does not support Web Speech API (try Chrome). You can still use text-based AI feedback later.";
    aiInterviewError.classList.remove("hidden");
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    aiAnswerText.textContent = transcript;
    recognizing = false;
    updateInterviewButtons();
    await sendAnswerForFeedback(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event);
    recognizing = false;
    updateInterviewButtons();
    aiInterviewError.textContent =
      "Speech recognition error: " + (event.error || "Unknown error");
    aiInterviewError.classList.remove("hidden");
  };

  recognition.onend = () => {
    recognizing = false;
    updateInterviewButtons();
  };

  return recognition;
}

function speakText(text) {
  try {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Speech synthesis error:", err);
  }
}

function updateInterviewButtons() {
  const hasQuestions = interviewQuestions && interviewQuestions.length > 0;
  aiInterviewNextBtn.disabled =
    !hasQuestions || currentQuestionIndex >= interviewQuestions.length - 1;
  aiInterviewRecordBtn.disabled = !hasQuestions || recognizing;
  aiInterviewStopBtn.disabled = !recognizing;
}

async function startInterview() {
  aiInterviewError.classList.add("hidden");
  aiInterviewError.textContent = "";

  if (!lastAnalysisData) {
    aiInterviewError.textContent = "Run a match analysis first.";
    aiInterviewError.classList.remove("hidden");
    return;
  }

  const jobText =
    lastAnalysisData.fullJobText || lastAnalysisData.jobSnippet;
  const resumeText =
    lastAnalysisData.fullResumeText || lastAnalysisData.resumeSnippet;

  aiInterviewStatus.textContent = "Generating AI interview questions...";
  aiQuestionText.textContent = "Loading questions...";
  aiAnswerText.textContent = "When you answer, transcript will appear here.";
  aiFeedbackOverall.textContent = "";
  aiFeedbackTips.innerHTML = "";
  aiFeedbackImproved.textContent = "";
  interviewQuestions = [];
  currentQuestionIndex = 0;

  try {
    const res = await fetch("/api/ai/interview/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobText, resumeText })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.error || "Failed to generate AI interview questions."
      );
    }

    const data = await res.json();
    interviewQuestions = data.questions || [];
    if (!interviewQuestions.length) {
      throw new Error("AI did not return any interview questions.");
    }

    currentQuestionIndex = 0;
    const q = interviewQuestions[currentQuestionIndex];
    aiQuestionText.textContent = q;
    aiInterviewStatus.textContent = `Question 1 of ${interviewQuestions.length}`;
    speakText(q);
  } catch (err) {
    console.error(err);
    aiInterviewError.textContent = err.message;
    aiInterviewError.classList.remove("hidden");
    aiInterviewStatus.textContent = "";
  } finally {
    updateInterviewButtons();
  }
}

async function sendAnswerForFeedback(answerTextValue) {
  if (!lastAnalysisData) return;
  if (!interviewQuestions.length) return;

  const question = interviewQuestions[currentQuestionIndex];
  const jobText =
    lastAnalysisData.fullJobText || lastAnalysisData.jobSnippet;
  const resumeText =
    lastAnalysisData.fullResumeText || lastAnalysisData.resumeSnippet;

  aiInterviewStatus.textContent = "AI is analysing your answer...";
  aiFeedbackOverall.textContent = "";
  aiFeedbackTips.innerHTML = "";
  aiFeedbackImproved.textContent = "";

  try {
    const res = await fetch("/api/ai/interview/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        answer: answerTextValue,
        jobText,
        resumeText
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.error || "AI feedback failed. Please try again later."
      );
    }

    const data = await res.json();
    aiFeedbackOverall.textContent = `Score ${data.score || 0}/10 – ${
      data.overall || ""
    }`;

    aiFeedbackTips.innerHTML = "";
    (data.tips || []).forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      aiFeedbackTips.appendChild(li);
    });

    aiFeedbackImproved.textContent = data.improvedAnswer || "";
    aiInterviewStatus.textContent =
      "Feedback ready. You can move to next question or refine your answer.";

    if (data.overall) {
      speakText(data.overall);
    }
  } catch (err) {
    console.error(err);
    aiInterviewError.textContent = err.message;
    aiInterviewError.classList.remove("hidden");
    aiInterviewStatus.textContent = "";
  } finally {
    updateInterviewButtons();
  }
}

// Interview buttons
aiInterviewStartBtn.addEventListener("click", () => {
  startInterview();
});

aiInterviewNextBtn.addEventListener("click", () => {
  if (!interviewQuestions.length) return;
  if (currentQuestionIndex < interviewQuestions.length - 1) {
    currentQuestionIndex += 1;
    const q = interviewQuestions[currentQuestionIndex];
    aiQuestionText.textContent = q;
    aiAnswerText.textContent =
      "When you answer, transcript will appear here.";
    aiFeedbackOverall.textContent = "";
    aiFeedbackTips.innerHTML = "";
    aiFeedbackImproved.textContent = "";
    aiInterviewStatus.textContent = `Question ${
      currentQuestionIndex + 1
    } of ${interviewQuestions.length}`;
    speakText(q);
  }
  updateInterviewButtons();
});

aiInterviewRecordBtn.addEventListener("click", () => {
  const rec = initSpeechRecognition();
  if (!rec) return;
  if (recognizing) return;
  aiInterviewError.classList.add("hidden");
  aiInterviewError.textContent = "";

  recognizing = true;
  updateInterviewButtons();
  aiInterviewStatus.textContent =
    "Listening... speak your answer. Click Stop to cancel.";
  try {
    rec.start();
  } catch (err) {
    console.error("recognition.start error:", err);
    recognizing = false;
    updateInterviewButtons();
    aiInterviewError.textContent =
      "Could not start voice recognition. Check microphone permissions.";
    aiInterviewError.classList.remove("hidden");
  }
});

aiInterviewStopBtn.addEventListener("click", () => {
  if (recognition && recognizing) {
    recognition.stop();
  }
});

// ---------- AI Cover Letter ----------
async function generateCoverLetter() {
  if (!lastAnalysisData) {
    coverLetterOutput.value =
      "Run Analyze Match first so I know your resume + JD.";
    return;
  }

  const resumeText =
    lastAnalysisData.fullResumeText || lastAnalysisData.resumeSnippet;
  const jobText =
    lastAnalysisData.fullJobText || lastAnalysisData.jobSnippet;
  const jobTitle = lastAnalysisData.jobTitle || "";
  const companyName = lastAnalysisData.company || "";
  const applicantName = applicantNameInput.value.trim();

  coverLetterOutput.value = "Generating cover letter with ApplyEasy...";

  try {
    const res = await fetch("/api/ai/cover-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        jobText,
        jobTitle,
        companyName,
        applicantName
      })
    });
    const data = await res.json();
    if (data.error) {
      coverLetterOutput.value = "Error: " + data.error;
      return;
    }
    coverLetterOutput.value =
      data.coverLetter || "No cover letter text returned.";
  } catch (err) {
    console.error(err);
    coverLetterOutput.value =
      "Something went wrong while generating cover letter. Try again.";
  }
}
generateCoverLetterBtn?.addEventListener("click", generateCoverLetter);

// ---------- AI Mentor ----------
async function askMentor() {
  const msg = mentorQuestionEl.value.trim();
  if (!msg) {
    alert("Pehle koi question type karo.");
    return;
  }
  const resumeText =
    lastAnalysisData?.fullResumeText || lastAnalysisData?.resumeSnippet || "";
  const jobText =
    lastAnalysisData?.fullJobText || lastAnalysisData?.jobSnippet || "";

  mentorAnswerEl.textContent = "Thinking like ApplyEasy Mentor...";

  try {
    const res = await fetch("/api/ai/mentor-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, resumeText, jobText })
    });
    const data = await res.json();
    if (data.error) {
      mentorAnswerEl.textContent = "Error: " + data.error;
      return;
    }
    mentorAnswerEl.textContent = data.reply || "No reply from mentor.";
  } catch (err) {
    console.error(err);
    mentorAnswerEl.textContent =
      "Something went wrong while talking to mentor. Try again.";
  }
}
askMentorBtn?.addEventListener("click", askMentor);

// ---------- Tracker (Mongo-backed Kanban) ----------
async function fetchTrackerJobs() {
  if (!currentUserId) return [];
  try {
    const res = await fetch(
      `/api/tracker/jobs?userId=${encodeURIComponent(currentUserId)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

function trackerBoardAddListeners() {
  document.querySelectorAll(".tracker-status-select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.value;
      await updateTrackerJob(id, { status: newStatus });
      await loadTracker();
    });
  });

  document.querySelectorAll(".tracker-notes-input").forEach((ta) => {
    ta.addEventListener("blur", async (e) => {
      const id = e.target.dataset.id;
      const notes = e.target.value;
      await updateTrackerJob(id, { notes });
    });
  });

  document.querySelectorAll(".tracker-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      await deleteTrackerJob(id);
      await loadTracker();
    });
  });
}

function renderTrackerBoard(jobs) {
  Object.values(trackerCols).forEach((col) => {
    if (col) col.innerHTML = "";
  });

  if (!jobs || !jobs.length) {
    trackerStatusMsg.textContent = "No jobs in your tracker yet.";
    return;
  }
  trackerStatusMsg.textContent = "";

  jobs.forEach((job) => {
    const targetCol =
      trackerCols[job.status] || trackerCols.saved || null;
    if (!targetCol) return;

    const card = document.createElement("div");
    card.className = "tracker-card";
    card.innerHTML = `
      <div class="tracker-card-header">
        <div class="tracker-card-title">${job.jobTitle || "Job"}</div>
        <div class="tracker-card-company">${job.company || ""}</div>
      </div>
      <div class="tracker-card-body">
        <div class="tracker-card-score">Match: ${
          job.matchScore ?? "-"
        }%</div>
        ${
          job.jobUrl
            ? `<a href="${job.jobUrl}" target="_blank" class="tracker-link">Open job</a>`
            : ""
        }
        <textarea class="tracker-notes-input" data-id="${
          job._id
        }" placeholder="Notes...">${job.notes || ""}</textarea>
        <label class="tracker-status-label">
          Status:
          <select class="tracker-status-select" data-id="${job._id}">
            ${["saved","applied","interview","offer","rejected"]
              .map(
                (st) =>
                  `<option value="${st}" ${
                    job.status === st ? "selected" : ""
                  }>${st[0].toUpperCase() + st.slice(1)}</option>`
              )
              .join("")}
          </select>
        </label>
        <button class="tracker-delete-btn" data-id="${
          job._id
        }">Delete</button>
      </div>
    `;
    targetCol.appendChild(card);
  });

  trackerBoardAddListeners();
}

async function loadTracker() {
  if (!currentUserId || !trackerCols.saved) return;
  const jobs = await fetchTrackerJobs();
  renderTrackerBoard(jobs);
}

async function saveToTracker() {
  if (!currentUserId) {
    trackerStatusMsg.textContent =
      "Login first to use the tracker (username at top).";
    return;
  }
  if (!lastAnalysisData) {
    trackerStatusMsg.textContent =
      "Analyse a job first, then save it to tracker.";
    return;
  }
  trackerStatusMsg.textContent = "Saving to tracker...";

  try {
    const res = await fetch("/api/tracker/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        jobTitle: lastAnalysisData.jobTitle,
        company: lastAnalysisData.company,
        jobUrl: lastAnalysisData.jobUrl,
        matchScore: lastAnalysisData.matchScore,
        status: "saved"
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to save.");
    }
    trackerStatusMsg.textContent = "Saved to tracker ✅";
    await loadTracker();
  } catch (err) {
    console.error(err);
    trackerStatusMsg.textContent =
      "Error saving to tracker: " + err.message;
  }
}

async function updateTrackerJob(id, updates) {
  try {
    await fetch(`/api/tracker/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
  } catch (err) {
    console.error(err);
  }
}

async function deleteTrackerJob(id) {
  try {
    await fetch(`/api/tracker/jobs/${id}`, {
      method: "DELETE"
    });
  } catch (err) {
    console.error(err);
  }
}

saveToTrackerBtn?.addEventListener("click", saveToTracker);

// ---------- LinkedIn Optimizer ----------
async function generateLinkedIn() {
  const analysis = lastAnalysisData || {};
  const resumeText =
    analysis.fullResumeText || analysis.resumeSnippet || "";
  const jobText = analysis.fullJobText || analysis.jobSnippet || "";

  if (!resumeText && !jobText) {
    linkedinAboutOutput.value =
      "Run Analyze Match first so I can read your resume + JD.";
    return;
  }

  const targetRole = linkedinRoleInput.value.trim();
  const tone = linkedinToneSelect.value;

  linkedinAboutOutput.value = "Generating LinkedIn About...";
  linkedinHeadlinesOutput.innerHTML = "";

  try {
    const res = await fetch("/api/ai/linkedin-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jobText, targetRole, tone })
    });
    const data = await res.json();
    if (data.error) {
      linkedinAboutOutput.value = "Error: " + data.error;
      return;
    }
    linkedinAboutOutput.value = data.about || "";

    const headlines =
      data.headlines || data.headlineSuggestions || [];
    linkedinHeadlinesOutput.innerHTML = "";
    headlines.forEach((h) => {
      const li = document.createElement("li");
      li.textContent = h;
      linkedinHeadlinesOutput.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    linkedinAboutOutput.value =
      "Something went wrong while generating LinkedIn content.";
  }
}
generateLinkedInBtn?.addEventListener("click", generateLinkedIn);

// ---------- PDF Match Report ----------
async function downloadReport() {
  if (!lastAnalysisData) {
    alert("Run Analyze Match first.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  const line = (text, size = 11, gap = 6) => {
    doc.setFontSize(size);
    const split = doc.splitTextToSize(text, 180);
    doc.text(split, 10, y);
    y += gap * (split.length || 1);
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
  };

  line("ApplyEasy – AI Match Report", 16, 8);
  line(
    `Job: ${lastAnalysisData.jobTitle || "N/A"}`,
    12,
    7
  );
  line(
    `Company: ${lastAnalysisData.company || "N/A"}`,
    12,
    7
  );
  line(
    `Match Score: ${lastAnalysisData.matchScore ?? "-"}%`,
    12,
    8
  );
  line("");

  line("Summary:", 13, 7);
  line(lastAnalysisData.summary || "No summary.", 11, 7);
  line("");

  const arrToText = (label, arr) =>
    `${label}: ${arr && arr.length ? arr.join(", ") : "None"}`;

  line(arrToText("Common skills", lastAnalysisData.commonSkills), 11, 7);
  line(arrToText("Missing skills", lastAnalysisData.missingSkills), 11, 7);
  line(arrToText("Extra skills", lastAnalysisData.extraSkills), 11, 7);
  line("");

  const tipsLis = Array.from(
    aiResumeTipsEl?.querySelectorAll("li") || []
  ).map((li) => li.textContent);
  if (tipsLis.length) {
    line("AI Resume Tips:", 13, 7);
    tipsLis.forEach((t) => line("• " + t, 11, 6));
    line("");
  }

  const bulletsLis = Array.from(
    aiResumeBulletsEl?.querySelectorAll("li") || []
  ).map((li) => li.textContent);
  if (bulletsLis.length) {
    line("AI Tailored Bullets:", 13, 7);
    bulletsLis.forEach((t) => line("• " + t, 11, 6));
    line("");
  }

  if (aiResumeHeadlineEl?.textContent) {
    line("Suggested Resume Headline:", 13, 7);
    line(aiResumeHeadlineEl.textContent, 11, 7);
    line("");
  }

  if (coverLetterOutput?.value) {
    line("Generated Cover Letter:", 13, 7);
    line(coverLetterOutput.value, 10, 6);
  }

  doc.save("ApplyEasy_Match_Report.pdf");
}
downloadReportBtn?.addEventListener("click", downloadReport);

// ---------- AI Resume Builder ----------
async function generateResumeDraft() {
  const fullName = builderNameInput.value.trim();
  const email = document.getElementById("builderEmail").value.trim();
  const phone = document.getElementById("builderPhone").value.trim();
  const location = document
    .getElementById("builderLocation")
    .value.trim();
  const role = document.getElementById("builderRole").value.trim();
  const level = document.getElementById("builderExperience").value;
  const skills = document.getElementById("builderSkills").value.trim();
  const projects = document
    .getElementById("builderProjects")
    .value.trim();
  const achievements = document
    .getElementById("builderAchievements")
    .value.trim();

  if (!fullName || !role) {
    alert("Please fill at least your name and target role.");
    return;
  }

  resumeBuilderOutput.value = "Generating resume draft with AI...";

  try {
    const res = await fetch("/api/ai/resume-builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        location,
        role,
        level,
        skills,
        projects,
        achievements
      })
    });

    const data = await res.json();
    if (data.error) {
      resumeBuilderOutput.value = "Error: " + data.error;
      return;
    }
    resumeBuilderOutput.value = data.resumeText || "";
  } catch (err) {
    console.error(err);
    resumeBuilderOutput.value =
      "Something went wrong while generating resume. Try again.";
  }
}
// ---------- Resume PDF Builder ----------
const resumeBuilderForm = document.getElementById("resume-builder-form");
const resumeBuilderStatus = document.getElementById("resume-builder-status");

if (resumeBuilderForm) {
  resumeBuilderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (resumeBuilderStatus) {
      resumeBuilderStatus.textContent = "Generating PDF resume...";
    }

    try {
      const formData = new FormData(resumeBuilderForm);
      const payload = {};
      for (const [key, value] of formData.entries()) {
        payload[key] = value;
      }

      const res = await fetch("/api/resume-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || "Failed to generate resume PDF."
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ApplyEasy_Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (resumeBuilderStatus) {
        resumeBuilderStatus.textContent = "PDF downloaded 🎉";
      }
    } catch (err) {
      console.error(err);
      if (resumeBuilderStatus) {
        resumeBuilderStatus.textContent =
          err.message || "Something went wrong while generating PDF.";
      }
    }
  });
}
// ========== Resume PDF Builder (jsPDF) ==========

const downloadResumePdfBtn = document.getElementById("downloadResumePdfBtn");

if (downloadResumePdfBtn) {
  downloadResumePdfBtn.addEventListener("click", () => {
    try {
      generateResumePdf();
    } catch (err) {
      console.error("Resume PDF error:", err);
      alert(
        "Sorry, could not generate the resume PDF. See console for details."
      );
    }
  });
}

function generateResumePdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded. Check the jsPDF script tag in index.html.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ------- Collect form values -------
  const fullName =
    document.getElementById("pdfFullName").value.trim() || "Your Name";
  const phone =
    document.getElementById("pdfPhone").value.trim() || "Phone";
  const email =
    document.getElementById("pdfEmail").value.trim() || "email@example.com";
  const linkedin =
    document.getElementById("pdfLinkedin").value.trim() || "";
  const github =
    document.getElementById("pdfGithub").value.trim() || "";
  const summary =
    document.getElementById("pdfSummary").value.trim() || "";
  const education =
    document.getElementById("pdfEducation").value.trim() || "";
  const skillsRaw =
    document.getElementById("pdfSkills").value.trim() || "";
  const projectsRaw =
    document.getElementById("pdfProjects").value.trim() || "";
  const certsRaw =
    document.getElementById("pdfCertifications").value.trim() || "";
  const extrasRaw =
    document.getElementById("pdfExtras").value.trim() || "";

  const skills = skillsRaw
    ? skillsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const projects = projectsRaw
    ? projectsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const certs = certsRaw
    ? certsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const extras = extrasRaw
    ? extrasRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // ------- Layout helpers -------
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Header: Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(fullName, pageWidth / 2, y, { align: "center" });
  y += 8;

  // Contact line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const contactParts = [phone, email];
  if (linkedin) contactParts.push(linkedin);
  if (github) contactParts.push(github);
  const contactLine = contactParts.join("  |  ");

  const contactLines = doc.splitTextToSize(contactLine, contentWidth);
  contactLines.forEach((line) => {
    doc.text(line, pageWidth / 2, y, { align: "center" });
    y += 5;
  });
  y += 2;

  // Top divider
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  function addSection(title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title.toUpperCase(), margin, y);
    y += 5;
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  function addParagraph(text) {
    if (!text) return;
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 2;
  }

  function addBullets(items) {
    items.forEach((item) => {
      const lines = doc.splitTextToSize("• " + item, contentWidth);
      lines.forEach((line) => {
        doc.text(line, margin, y);
        y += 5;
      });
      y += 1;
    });
    y += 2;
  }

  function ensureSpace(extra = 30) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + extra > pageHeight - 15) {
      doc.addPage();
      y = 20;
    }
  }

  // ------- Sections like your LaTeX resume -------

  // Profile Summary
  if (summary) {
    ensureSpace(30);
    addSection("Profile Summary");
    addParagraph(summary);
  }

  // Education
  if (education) {
    ensureSpace(20);
    addSection("Education");
    addParagraph(education);
  }

  // Technical Skills
  if (skills.length) {
    ensureSpace(30);
    addSection("Technical Skills");
    addBullets(skills);
  }

  // Projects
  if (projects.length) {
    ensureSpace(40);
    addSection("Projects");
    addBullets(projects);
  }

  // Certifications
  if (certs.length) {
    ensureSpace(30);
    addSection("Certifications");
    addBullets(certs);
  }

  // Extracurricular / Additional
  if (extras.length) {
    ensureSpace(30);
    addSection("Extracurricular & Additional");
    addBullets(extras);
  }

  // Finally download
  doc.save("Resume.pdf");
}

resumeBuilderGenerateBtn?.addEventListener("click", generateResumeDraft);
