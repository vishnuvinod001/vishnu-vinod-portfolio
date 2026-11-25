/* ==========================================================
   RESUME DATA — edit ONLY this file to update the whole site.
   The page, terminal, AI chat and voice all read from here.
   (It's a .js file instead of .json so it also works when you
    open index.html directly, without a server.)
   ========================================================== */
window.RESUME = {
  name: "Vishnu Vinod",
  shortName: "vishnu",
  botName: "GHOST",                       // the chat assistant is named after my GHOST project
  title: "AI Engineer",
  company: "AIMS Kochi",
  location: "Kochi, Kerala, India",
  email: "kulathoorvishnu@gmail.com",
  links: {
    linkedin: "https://www.linkedin.com/in/vinodvishnu",
    github: "https://github.com/vishnuvinod001",
    leetcode: "https://leetcode.com/u/vishnuvinod03/"
  },

  headline: "Building useful intelligence.",
  tagline: "AI Engineer building LLM applications and agentic systems. MCA graduate (CGPA 9.0) with hands-on experience in RAG pipelines, local LLM systems and enterprise automation.",

  typing: [
    "building GHOST, a local AI with memory",
    "RAG over embeddings + FAISS",
    "tool use through MCP",
    "parsing resumes with vLLM",
    "B.Sc Physics → AI engineering"
  ],

  // tech "planets" orbiting the AI core in the hero (inner → outer ring)
  orbits: [
    ["Python", "FastAPI", "SQL"],
    ["Ollama", "FAISS", "vLLM"],
    ["MCP", "RAG", "Frappe", "SQLite"]
  ],

  stats: [
    { text: "9.00",          label: "MCA CGPA" },
    { value: 5,  suffix: "", label: "Hospital systems at AIMS" },
    { value: 78, suffix: "%", label: "Region-selection accuracy" },
    { value: 175, suffix: "", label: "NEAT agent best score" }
  ],

  about: [
    "I'm an <strong>AI-focused software developer</strong>. I build LLM applications, RAG pipelines and workflow automation, mostly in <strong>Python</strong> with <strong>FastAPI</strong> and SQL.",
    "At <strong>Amrita Institute of Medical Sciences</strong> in Kochi, I work in the Digital Transformation team on internal tools for hospital operations, from resume parsing with <strong>vLLM</strong> to ticketing, HR and procurement systems.",
    "Outside work I build <strong>GHOST</strong>, a local AI assistant with persistent memory that runs on my own machine and uses tools through <strong>MCP</strong>. My first degree was in <strong>Physics</strong>, which is where I learned to like models of how things work."
  ],

  highlights: [
    { icon: "agent", title: "Agentic AI",            text: "GHOST plans, remembers and acts: persistent memory in SQLite and browser and filesystem tools through MCP." },
    { icon: "search", title: "Retrieval (RAG)",      text: "Embeddings and FAISS vector search give a local Ollama model the right context before it answers." },
    { icon: "spark", title: "Research",              text: "A training-free GALIP + SAM + CLIP pipeline that controls regions of generated images: 78% region-selection accuracy." }
  ],

  skills: {
    "AI and LLMs":              ["LLM applications", "RAG", "Embeddings", "FAISS", "Ollama", "vLLM", "NLP", "NEAT"],
    "Agentic AI":               ["MCP", "Tool-augmented reasoning", "Persistent memory", "Local LLMs"],
    "Backend":                  ["FastAPI", "Django", "REST APIs"],
    "Languages":                ["Python", "Java", "C", "JavaScript", "SQL"],
    "Databases and frameworks": ["SQLite", "SQL Server", "Frappe"],
    "Tools":                    ["Git", "GitHub", "MCP"]
  },

  experience: [
    {
      role: "Application Developer Intern",
      company: "Amrita Institute of Medical Sciences (AIMS), Kochi · Digital Transformation, IT Department",
      period: "Jul 2026 — Present",
      points: [
        "Built an <b>AI resume parser on vLLM</b> that extracts structured candidate data from PDFs and fills recruitment forms.",
        "Automated <b>ticket creation from Outlook emails</b>, with department assignment and tracking, for facilities management.",
        "Building a <b>central HR platform</b> covering employee records, biometric attendance and shift scheduling.",
        "Migrated <b>pathology records</b> from a live SQL Server database into Frappe.",
        "Rebuilt <b>procurement request and approval workflows</b> for a system dormant for about 16 years."
      ]
    }
  ],

  projects: [
    { id: "ghost", category: "personal", featured: true, live: true, label: "Featured · Jun 2026 – Present", viz: "vector",
      title: "GHOST — a personal AI operating system",
      summary: "A local AI assistant with persistent memory, document retrieval and tool-augmented reasoning. RAG over embeddings and FAISS gives contextual answers; browser and filesystem MCP tools let it search the web, extract content and manage files.",
      pipeline: ["query", "embed", "FAISS top-k", "Ollama", "MCP tools", "answer"],
      card: [["Model", "Ollama (local)"], ["Retrieval", "FAISS"], ["Memory", "SQLite"], ["Tools", "MCP"]],
      problem: "Cloud assistants forget context between sessions and can't safely touch my own files. I wanted an assistant that runs on my machine, remembers, and can act.",
      built: ["Local LLM served through Ollama behind a FastAPI service", "RAG: documents embedded and searched with FAISS vector search", "Persistent memory stored in SQLite", "Browser and filesystem tools exposed through MCP for search, extraction and file management"],
      impact: "A private assistant that answers from my own documents, keeps memory across sessions and uses tools, with nothing leaving the machine.",
      stack: ["Python", "FastAPI", "Ollama", "FAISS", "SQLite", "MCP"] },

    { id: "research", category: "personal", label: "Research publication", viz: "segment",
      title: "Post-generation segmentation for GAN text-to-image models",
      summary: "A training-free pipeline that combines GALIP, SAM and CLIP to control specific regions of generated images, with no retraining of the generator.",
      pipeline: ["prompt", "GALIP", "SAM masks", "CLIP scoring", "edited region"],
      card: [["Region accuracy", "78%"], ["Mean CLIP", "0.591"], ["Prompts", "120"], ["Retraining", "none"]],
      problem: "GAN text-to-image models generate a whole image at once, so changing one region usually means retraining or regenerating everything.",
      built: ["GALIP generates the image from text", "SAM segments it into candidate region masks", "CLIP scores the masks against the prompt to pick the target region", "Evaluation over 120 prompts"],
      impact: "78% region-selection accuracy and a mean CLIP score of 0.591 across 120 prompts, without retraining the generator.",
      stack: ["GALIP", "SAM", "CLIP", "Python"] },

    { id: "flappy", category: "personal", label: "Personal project · Mar 2025", viz: "neat",
      title: "Flappy Bird automation with NEAT",
      summary: "An agent that learns to play Flappy Bird by evolving neural network topologies through mutation, crossover and speciation. Best score: 175.",
      pipeline: ["game state", "neural net", "flap?", "fitness", "evolve"],
      card: [["Method", "Neuroevolution"], ["Best score", "175"], ["Ops", "mutate · crossover"]],
      problem: "Teach an agent to play without labelled data or hand-written rules.",
      built: ["Pygame Flappy Bird environment", "NEAT-Python evolving network topology and weights", "Fitness from distance survived and pipes passed", "Speciation to protect new structures"],
      impact: "The agent learned to fly through pipes on its own and reached a best score of 175.",
      stack: ["Python", "Pygame", "NEAT-Python"] },

    { id: "resumebank", category: "aims", label: "AIMS Kochi · AI", viz: "parse",
      title: "Resume Bank",
      summary: "Parses PDF resumes with vLLM into structured candidate data, then fills the recruitment form automatically.",
      pipeline: ["PDF", "text", "vLLM", "JSON fields", "form"],
      card: [["Serving", "vLLM"], ["Output", "structured JSON"]],
      problem: "Recruiters were re-typing candidate details from PDF resumes into the recruitment form.",
      built: ["PDF text extraction", "LLM prompt served with vLLM that returns structured candidate fields", "Automatic filling of the recruitment form"],
      impact: "Candidate data goes from PDF to form without manual typing.",
      stack: ["Python", "JavaScript", "vLLM"] },

    { id: "ticketing", category: "aims", label: "AIMS Kochi · Automation", viz: "route",
      title: "Facilities management ticketing",
      summary: "Creates service tickets from Outlook emails, pulling the subject, body and attachments, then assigns each ticket to a department and tracks it. Built as a base other departments can reuse.",
      pipeline: ["Outlook email", "parse", "ticket", "route to dept", "track"],
      card: [["Source", "Outlook API"], ["Platform", "Frappe"]],
      problem: "Facilities requests arrived by email and had to be logged and forwarded by hand.",
      built: ["Outlook API integration that reads subject, body and attachments", "Automatic ticket creation in Frappe", "Department assignment and status tracking", "Reusable base for other departments"],
      impact: "Every facilities email becomes a tracked ticket with an owner.",
      stack: ["Python", "JavaScript", "Outlook API", "Frappe"] },

    { id: "ptc", category: "aims", label: "AIMS Kochi · Workflow", viz: "approval",
      title: "PTC Weaver",
      summary: "Studied a procurement system that had sat unused for about 16 years, then built request and approval workflows for purchasing across hospital departments.",
      pipeline: ["request", "review", "approval", "purchase"],
      card: [["Dormant", "~16 years"], ["Platform", "Frappe"]],
      problem: "A procurement system had been unused for about 16 years, and purchasing approvals ran outside it.",
      built: ["Studied the existing system and its data", "Request and approval workflows for purchasing", "Coverage across hospital departments"],
      impact: "Purchasing requests now move through a defined approval workflow.",
      stack: ["Python", "JavaScript", "Frappe"] },

    { id: "hr", category: "aims", label: "AIMS Kochi · In progress", viz: "attendance",
      title: "Internal HR management",
      summary: "One HR platform for employee records, biometric attendance and shift scheduling, with attendance reports, shift-change workflows and automatic approval notifications.",
      pipeline: ["biometric punch", "attendance", "shifts", "approvals", "reports"],
      card: [["Status", "in progress"], ["Platform", "Frappe + SQL"]],
      problem: "Employee records, attendance and shift scheduling lived in separate places.",
      built: ["Employee records", "Biometric attendance integration and reports", "Shift scheduling and shift-change workflows", "Automatic approval notifications"],
      impact: "One place for HR data, attendance and shifts (in progress).",
      stack: ["Python", "JavaScript", "Frappe", "SQL"] },

    { id: "pathology", category: "aims", label: "AIMS Kochi · Data", viz: "migrate",
      title: "Lesion Index of Pathology",
      summary: "Queried a live SQL Server database to extract and map pathology records for migration. Cleaned and validated large datasets in Excel before importing them into Frappe.",
      pipeline: ["SQL Server", "extract", "map", "validate", "Frappe"],
      card: [["Source", "MSSQL (live)"], ["Target", "Frappe"]],
      problem: "Pathology records had to move from a live SQL Server database into Frappe without losing or corrupting data.",
      built: ["SQL queries to extract and map records", "Cleaning and validation of large datasets in Excel", "Import into Frappe"],
      impact: "Pathology records migrated into Frappe after validation.",
      stack: ["MSSQL", "SQL", "Python", "Excel", "Frappe"] }
  ],

  education: [
    { degree: "Master of Computer Applications", school: "Amrita Vishwa Vidyapeetham, Kochi", period: "Jul 2024 — Aug 2026", score: "CGPA 9.00",
      detail: "Research: post-generation segmentation for GAN text-to-image models (GALIP, SAM, CLIP)." },
    { degree: "Bachelor of Science in Physics", school: "Bharata Mata College, Ernakulam", period: "Oct 2021 — May 2024", score: "CGPA 7.18",
      detail: "Where the curiosity started: atoms, fields and the models that explain them." }
  ],

  certifications: [
    { name: "Python Programming, Parts 1 and 2", by: "Infosys Springboard, 2025" },
    { name: "Database and SQL",                  by: "Infosys Springboard, 2025" }
  ],
  awards: [
    { name: "NCC B and C Certificates",  by: "A Grade" },
    { name: "Army Attachment Camp",      by: "22 Rajputana Rifles, 2023" }
  ],

  openTo: "AI Engineer, Agentic AI Engineer and Software Engineer roles",

  // Extra answers for the AI chat. "k" = trigger keywords, "a" = answer.
  faq: [
    { k: ["why", "strength", "different", "unique", "should we"],
      a: "Three things stand out: he has <b>built an agentic system end to end</b> (GHOST: local LLM, RAG, memory, MCP tools), he <b>ships AI inside real hospital workflows</b> at AIMS, and he has <b>published research</b> on controllable image generation." },
    { k: ["ghost", "assistant", "agent", "local ai", "operating system"],
      a: "<b>GHOST</b> is Vishnu's personal AI operating system: a local Ollama model with RAG over FAISS, persistent memory in SQLite, and browser and filesystem tools through MCP. (I'm a small scripted demo named after it. The real GHOST runs on his machine.)" },
    { k: ["rag", "retrieval", "faiss", "vector", "embedding"],
      a: "He builds RAG pipelines: documents are embedded, indexed with <b>FAISS</b>, and the top-k chunks are given to a local LLM as context before it answers." },
    { k: ["mcp", "tool", "tools"],
      a: "GHOST uses the <b>Model Context Protocol (MCP)</b> for browser and filesystem tools, so it can search the web, extract content and manage files." },
    { k: ["physics", "bsc", "science", "atom"],
      a: "Before computing he studied <b>Physics</b> (B.Sc, Bharata Mata College, 2021–2024). Scroll to the Education section to zoom into an atom, all the way down to quarks." },
    { k: ["research", "paper", "publication", "galip", "sam", "clip", "gan"],
      a: "His research combines <b>GALIP, SAM and CLIP</b> into a training-free pipeline that controls specific regions of generated images: 78% region-selection accuracy and a mean CLIP score of 0.591 over 120 prompts." },
    { k: ["leetcode", "dsa", "problem solving", "algorithm"],
      a: `He practises problem solving on LeetCode. <a href="https://leetcode.com/u/vishnuvinod03/" target="_blank" rel="noopener">See his profile</a>.` },
    { k: ["ncc", "army", "award"],
      a: "He holds the <b>NCC B and C Certificates (A Grade)</b> and attended the Army Attachment Camp with 22 Rajputana Rifles in 2023." },
    { k: ["ai", "llm", "vllm", "ollama", "machine learning", "ml", "genai", "artificial"],
      a: "AI work so far:<br>• <b>GHOST</b>: local LLM + RAG + memory + MCP tools<br>• <b>Resume Bank</b>: PDF resumes parsed with vLLM at AIMS<br>• <b>Research</b>: GALIP + SAM + CLIP region control<br>• <b>NEAT</b>: a neuroevolved Flappy Bird agent" }
  ]
};
