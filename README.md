# ApplyEasy – AI-Powered Job Fit & Interview Prep

ApplyEasy is a web app that helps job seekers quickly check how well their resume matches a job description, identify missing skills, and practice interviews – all in one place.

🔗 **Live Demo:** https://applyhelp.onrender.com  

---

## ✨ Features

### 🔐 Playful Login Screen
- Cute panda mascot with a dark, modern UI.
- Simple username/password form (front-end only – no real auth).
- Smooth card layout and gradients to set a premium, “product-ready” feel.

---

### 📄 Upload Resume & Job Profile

On the main dashboard you can:

- **Upload your resume** (PDF / text).
- **Paste a job link or job description.**
- Let ApplyEasy analyse both and show:

- ✅ **Overall Match %** (e.g., *“85% Match”*).
- 🟢 **Common Skills** – in both resume & job.
- 🔴 **Missing / Weak Skills** – in the job, not in the resume.
- 🔵 **Extra Skills** – in the resume, not in the job.

This gives a quick snapshot of how close you are to the JD and what to improve.

---

### 🧠 AI Resume Coach

The **AI Resume Coach** section provides:

- 💡 **Resume Change Tips**  
  Suggestions about what to highlight or rephrase in your resume for this specific job (e.g., emphasising JSON data handling, MERN/Next.js stack, etc.).

- ✍️ **AI-Tailored Bullets**  
  Ready-to-adapt bullet points you can paste into your resume to make it more achievement-driven and aligned to the job.

---

### 🎤 AI Interview (Voice)

Practice a voice-based interview directly in the browser:

- ▶️ **Start Interview** – get AI-generated questions based on the job.
- ⏭ **Next Question** – move through a sequence of tailored questions.
- 🎙 **Speak Answer** – record your answer; the app shows a live **transcript**.
- 💬 **AI Feedback** – suggested stronger answers you can refine and learn from.

This simulates a self-practice interview environment with targeted feedback.

---

### 📝 AI Cover Letter Generator

Generate a tailored, ATS-friendly cover letter for the job in a single click:

- Optional **“Your Name”** input.
- **Generate Cover Letter** button produces a structured, professional cover letter based on your resume & JD.
- Output appears in a scrollable panel so you can copy and edit it before using.

---

### 🧾 (Optional) PDF / Report Export

The project is wired with **jsPDF** (via CDN) so the content can be exported as a PDF report (e.g., match summary, recommended bullets, or cover letter).  
You can easily extend this to generate a downloadable “Job Fit Report” for users.

---

## 🏗 Tech Stack

- **Frontend:**  
  - HTML5  
  - CSS3 (custom gradients, card UI, responsive layout)  
  - Vanilla JavaScript (state handling, DOM updates, mock AI logic)

- **Styling & UI:**  
  - Dark, neumorphic-inspired card design  
  - Poppins font from Google Fonts  
  - Button hover effects and smooth transitions

- **Utilities / Libraries:**
  - [`jsPDF`](https://github.com/parallax/jsPDF) via CDN for PDF generation
  - Native `FileReader` / text parsing for resume & JD input

- **Backend / Hosting:**
  - Minimal **Node.js + Express** server (`server.js`) to serve static files from `public/`
  - Deployed on **Render**: https://applyhelp.onrender.com

> At the moment, “AI” outputs are front-end generated / mocked for demo purposes.  
> You can plug in a real LLM API (OpenAI, Gemini, etc.) in the JS layer to make it fully AI-powered.
>
> <img width="1919" height="1003" alt="Screenshot 2025-11-19 065546" src="https://github.com/user-attachments/assets/ec87366b-942a-4b96-9941-c0905b448be6" />
<img width="963" height="454" alt="Screenshot 2025-11-19 081149" src="https://github.com/user-attachments/assets/73c0d1cf-e288-4919-b740-e23156b28fe4" />



---

## 📂 Project Structure

```bash
ApplyHelp/
├── public/
│   ├── index.html          # Main UI (login + dashboard + tools)
│   ├── styles.css          # Global styles, gradients, layout
│   ├── script.js           # Core logic (parsing, matching, AI mocks)
│   └── assets/             # Images, icons, etc.
├── server.js               # Express server serving /public
├── package.json            # Dependencies & npm scripts
└── package-lock.json
