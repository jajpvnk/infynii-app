# 🔥 Infynii Hono API

The backend API powering Infynii's intelligent search experience. Built on [Hono](https://hono.dev/) — a high-performance web framework — and orchestrated by [LangGraph](https://langchain-ai.github.io/langgraph/) agents for web search and content summarization. 🧠⚡

---

## 🤔 What Does This Do?

This is the **server-side engine** of Infynii. When a user submits a question from the mobile app, this API:

1. **Receives the query** 📥 — Via the streaming HTTP endpoint
2. **Analyzes searchability** 🧐 — Determines if the query can produce meaningful search results
3. **Searches the web** 🌐 — Uses Tavily API to fetch relevant results
4. **Scores and filters results** ⚖️ — Only results above a 0.5 relevance threshold are included
5. **Retries if needed** 🔄 — Refines the query up to 3 times if results are insufficient
6. **Streams results back** 📡 — NDJSON streaming for real-time delivery to the mobile app
7. **Summarizes on demand** 📝 — Generates AI summaries of individual articles using Gemini

---

## 🏗️ Project Structure

```
hono-api/
├── src/
│   ├── index.ts              # 🚪 Server entry point (port 8787)
│   ├── router.ts             # 🧭 API route definitions
│   ├── middleware.ts          # 🛡️ Request middleware
│   ├── supabase.ts           # 🗄️ Supabase client setup
│   ├── constants.ts          # ⚙️ Configuration values
│   │
│   └── agents/               # 🤖 LangGraph Agent Definitions
│       ├── search/            # 🔍 Web Search Agent
│       │   ├── graph.ts       # State machine / graph definition
│       │   ├── tools.ts       # Tavily search tool bindings
│       │   ├── response.ts    # Response formatting and streaming
│       │   └── constants.ts   # Search-specific configuration
│       │
│       └── summarize/         # 📝 Content Summarization Agent
│           ├── graph.ts       # Summarization state machine
│           ├── tools.ts       # Tool definitions
│           └── response.ts    # Summary response formatting
│
├── dist/                      # 📦 Compiled JavaScript output
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

---

## 🧭 API Routes

All routes are prefixed with `/api/v1` 🏷️

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check 💓 |
| `GET` | `/frequencies` | Get search frequency filters 🎛️ |
| `POST` | `/stream` | Stream search results 📡 |
| `GET` | `/search/:id` | Get search metadata 🔮 |
| `PATCH` | `/search/:id/trash` | Mark search as trashed 🗑️ |
| `GET` | `/search-results/:id` | Get individual search result 🔬 |
| `POST` | `/search-results/:id/summarize` | Start content summarization 📝 |
| `PATCH` | `/search-results/:id/summary` | Save generated summary 💾 |

---

## 🤖 AI Agents

### 🔍 Search Agent (`src/agents/search/`)

The search agent is a LangGraph state machine that:

1. **Evaluates** whether the user's query is searchable 🤔
2. **Constructs** an optimized search query 🔧
3. **Calls Tavily API** to fetch web results 🌐
4. **Scores results** and filters by relevance threshold (`0.5`) 🎯
5. **Retries with refined queries** if results are insufficient (max 3 attempts) 🔄
6. **Streams results** back as NDJSON via tool messages 📡

**Configuration:**
- Max search results: **5** per query
- Min required results: **3** (triggers retry if below)
- Max search attempts: **3**

### 📝 Summarize Agent (`src/agents/summarize/`)

The summarization agent:

1. **Receives a search result URL/content** 📄
2. **Generates an AI summary** using Google Gemini 2.5 Flash 🧠
3. **Streams the summary** back to the client ⚡

---

## 🛠️ Tech Stack

| Component | Tech | Purpose |
|-----------|------|---------|
| Framework | Hono 4.7 | High-performance web framework |
| Runtime | Node.js | Server runtime |
| AI Orchestration | LangGraph + LangChain | Stateful agent orchestration |
| LLM | Google Gemini 2.5 Flash | Query analysis and summarization |
| Web Search | Tavily API | AI-optimized web search |
| Database | Supabase (PostgreSQL) | Persistence and authentication |
| Validation | Zod + @hono/zod-validator | Request schema validation |
| State Persistence | langgraph-checkpoint-postgres | Agent state checkpointing |

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | 🔥 Start dev server with hot reload (`tsx watch`) |
| `pnpm build` | 🏗️ Compile TypeScript to JavaScript |
| `pnpm start` | 🚀 Run production server (`node dist/index.js`) |

### Running from the monorepo root 🌳

```bash
pnpm api:dev     # Start dev server via Nx
pnpm api:build   # Build via Nx
```

---

## ⚙️ Configuration

### Environment Variables 🔐

| Variable | Description |
|----------|-------------|
| `TAVILY_API_KEY` | Tavily search API key 🔍 |
| `GOOGLE_API_KEY` | Google Gemini API key 🧠 |
| `SUPABASE_URL` | Supabase project URL 🗄️ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key 🔑 |
| `DATABASE_URL` | PostgreSQL connection string 🐘 |

### LLM Configuration 🤖

- **Model:** `gemini-2.5-flash`
- **Temperature:** `0` (deterministic output)
- **Max retries:** `0`

---

## 🐳 Docker

```bash
# Build production image
docker build -t infynii-api .

# Or use docker-compose from the monorepo root
docker-compose up
```

The API runs on **port 8787** 🎯
