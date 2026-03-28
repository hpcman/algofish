# 🐟 AlgoFish: The Agentic Algorithm Tutor & Synthesizer

**AlgoFish** is an AI-powered educational platform built for the **TinyFish SG Hackathon: Build on the Open Web**. 

Traditional competitive programming platforms lock their best editorials behind paywalls, heavy React/SPA rendering, or aggressive Cloudflare bot protection. AlgoFish bypasses these barriers using agentic web navigation. It extracts cryptic algorithmic concepts or specific problems from across the open web, synthesizes them into intuitive tutorials, and instantly generates novel practice challenges.

## 🚀 Core Features: The "God Mode" Pipeline

AlgoFish operates on a single, unified pipeline that handles both general algorithmic concepts (e.g., "Monotonic Deque") and highly specific, cryptic problem IDs (e.g., "CF 1503D").

* 🤖 **Agentic Web Extraction (TinyFish):** Seamlessly navigates dynamic UIs and bypasses bot protection to extract pure educational content, problem descriptions, and hidden editorials from platforms like LeetCode, CP-Algorithms, and Codeforces. Cross-language translation (e.g., Russian Codeforces to English) is handled on the fly.
* 🧠 **The Master Explainer & Prerequisite Mapper:** Chains the extracted raw data into OpenAI to break down complex algorithms. Before teaching the core intuition, the AI automatically maps out the **Required Prerequisites**. It then translates dense academic text into beginner-friendly steps, complete with rigorous mathematical analysis of time and space complexities (e.g., $O(N \log N)$ vs $O(V + E)$).
* 🚀 **Dynamic Problem Synthesis:** Closes the learning loop instantly. The moment AlgoFish finishes explaining a concept or problem, it automatically synthesizes a brand-new, mathematically sound practice problem (complete with a novel backstory and realistic constraints) designed to test the exact mechanics the user just learned.

## 📂 Architecture & Structure

AlgoFish is built as a modern monorepo, separating the Python-based AI agent orchestration from the dynamic React frontend.

```text
algofish/
├── backend/       # FastAPI server handling TinyFish/OpenAI agent orchestration
└── frontend/      # React + Vite UI for the interactive learning dashboard
```

## 🛠 Tech Stack

* **Backend:** Python, FastAPI, Pydantic
* **Frontend:** React, TypeScript, Vite, Tailwind CSS
* **AI & Agents:**
* ** **TinyFish API:**: For dynamic, agent-driven web search, extraction, and translation.
* ** **OpenAI API:** For multi-step reasoning, pedagogical formatting, mathematical rigor, and dynamic IP generation.