# Vishnu Vinod — AI Engineer Portfolio

Interactive 3D portfolio in plain HTML, CSS and JavaScript. No build step.

## What's on the page
- **3D flight (Three.js, `js/scene3d.js`)**: scrolling flies a camera through chapters:
  solar system → **transformer** (tokens, embeddings + positional sine, multi-head
  self-attention arcs, feed-forward, softmax over the next token) → code tunnel →
  **retrieval (RAG)** (embedding space, query → top-k → local LLM) → project screens →
  **atom zoom** in Education (atom → nucleus → proton → quarks → hypothetical string) →
  neural-sphere finale.
- **Neural network nav (`js/network.js`)**: the original layered network. Nav links are
  input neurons; clicking one fires a signal through the layers while the page scrolls.
  Click anywhere to send a signal.
- **Pixel sprites (`js/sprites.js`)**: the chibi (About), GHOST over its project card,
  and the desk scene (Contact).
- **Project cards (`js/cards.js`)**: model pipeline + model card on every card, live
  visuals (vector search, SAM/CLIP regions, NEAT Flappy Bird, PDF→fields, email routing),
  and the LeetCode stats card.
- GHOST chat assistant (scripted, speaks and listens), terminal, playground, 4 themes.

## Edit content
Everything lives in `data/resume.js`.

## Files
```
index.html            layout
data/resume.js        all content
css/style.css         base theme      css/vishnu.css  additions
js/app.js             theme, chat, voice, terminal, smooth scroll
js/render.js          builds sections from resume.js
js/scene3d.js         3D scene        js/motion.js    scroll motion + project gallery
js/network.js         neural network nav
js/sprites.js         pixel art       js/cards.js     card visuals + LeetCode
js/sims.js            Playground tabs + RAG simulation
js/ghost.js           Playground: GHOST agent simulation (router → MCP tools → memory → RAG → Qwen3 8B → SQLite)
js/attention.js       Playground: Attention simulation (one head, softmax(QKᵀ/√d)·V)
api/leetcode.js       Vercel function for live LeetCode stats
```

## Deploy (Vercel)
Import the repo, framework preset **Other**, no build command. `api/leetcode.js` runs as a
serverless function. If your existing deployment already has a working `/api/leetcode`,
keep yours. On GitHub Pages the API can't run, so the card shows a link to the profile.

After the first deploy, set `og:image` / `twitter:image` in `index.html` to the full URL.

Tip: `?fx=lite` forces the lighter mode for testing.
