# 🧠 Infynii — Smart AI Search App

Infynii is a **full-stack AI-powered search application** that combines a React Native mobile app with an intelligent backend powered by LangGraph agents. Users can ask questions through a chat interface, and AI agents will search the web, analyze results, and deliver summarized answers — all streamed in real-time. 📱🚀

---

## 🤔 What Does It Do?

1. **User submits a question** 💬 — Through the chat interface
2. **AI agents process the query** 🤖 — LangGraph orchestrates query analysis and web searches via Tavily
3. **Results stream in real-time** ⚡ — NDJSON streaming delivers search results as they are found
4. **Summaries on demand** 📝 — Tap any result to get an AI-generated summary powered by Google Gemini

---

## 🏗️ Project Structure

```
smart-info-ai-app/
│
├── 📱 apps/
│   ├── infynii/                 # React Native mobile app (Expo)
│   │   ├── app/                 # Expo Router screens & navigation
│   │   │   └── (tabs)/          # Tab-based navigation (chat, home, etc.)
│   │   ├── components/          # Reusable UI components
│   │   │   └── chat/            # Chat bubbles, inputs, search cards
│   │   ├── screens/             # Screen containers (ChatScreen, SearchResult)
│   │   ├── context/             # React Context providers (API client)
│   │   ├── helpers/             # Helper functions
│   │   ├── utils/               # Utility functions
│   │   ├── constants/           # App-wide constants
│   │   ├── assets/              # Images, fonts, icons
│   │   ├── android/             # Android native code 🤖
│   │   └── ios/                 # iOS native code 🍎
│   │
│   └── hono-api/                # Backend API server 🔥
│       └── src/
│           ├── index.ts         # Server entry point
│           ├── router.ts        # API route definitions
│           ├── middleware.ts     # Request middleware
│           ├── supabase.ts      # Database client
│           └── agents/          # 🧠 AI Agent definitions
│               ├── search/      # Web search agent (LangGraph)
│               └── summarize/   # Content summarization agent
│
├── 📦 packages/
│   └── shared/                  # Shared TypeScript types & utils
│       └── src/
│           ├── index.ts         # Core shared types
│           ├── server.ts        # LangGraph state types
│           ├── search.ts        # Search result types
│           ├── graph.ts         # Graph execution statuses
│           ├── summarize.ts     # Summarization types
│           └── db-schema.ts     # Supabase auto-generated types
│
├── 🐳 supabase/                 # Supabase local config
├── 📄 Dockerfile                # Production container
├── 📄 docker-compose.yml        # Dev environment orchestration
├── 📄 nx.json                   # Nx monorepo config
├── 📄 pnpm-workspace.yaml       # Workspace definitions
└── 📄 tsconfig.json             # Base TypeScript config
```

---

## 🛠️ Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| 📱 Mobile | React Native + Expo | Cross-platform mobile development |
| 🧭 Navigation | Expo Router | File-based routing |
| 🔥 Backend | Hono | Lightweight, high-performance web framework |
| 🧠 AI Agents | LangGraph + LangChain | Stateful agent orchestration |
| 🔍 Search | Tavily API | AI-optimized web search |
| 🤖 LLM | Google Gemini 2.0 Flash | Query analysis and content summarization |
| 🗄️ Database | Supabase (PostgreSQL) | Authentication, storage, and persistence |
| 📦 Monorepo | pnpm + Nx | Workspace management and build caching |
| 🐳 Containers | Docker | Consistent dev and production environments |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18 🟢
- **pnpm** >= 10.4.0 📦
- **Docker** 🐳 (for Supabase local development)
- **Expo CLI** (included with the project)
- iOS Simulator / Android Emulator (or a physical device 📲)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd smart-info-ai-app

# Install all dependencies
pnpm install

# Build shared packages
pnpm build
```

### Environment Variables 🔐

The following API keys are required:

- **Tavily API** — Web search 🔍
- **Google Gemini** — AI query analysis and summarization 🧠
- **Supabase** — Database and authentication 🗄️

---

## 📋 Commands

### Root Commands

| Command | Description |
|---------|-------------|
| `pnpm app:dev` | 📱 Start Expo development server |
| `pnpm app:dev:ios` | 🍎 Run on iOS simulator |
| `pnpm app:dev:android` | 🤖 Run on Android emulator |
| `pnpm api:dev` | 🔥 Start Hono API with hot reload |
| `pnpm api:build` | 🏗️ Build API for production |
| `pnpm build` | 📦 Build all packages |
| `pnpm gentypes` | 🧬 Generate Supabase TypeScript types |

### Quick Start (two terminals)

```bash
# Terminal 1 — Start the backend
pnpm api:dev

# Terminal 2 — Start the mobile app
pnpm app:dev:ios    # or app:dev:android
```

---

## 🐳 Docker

```bash
# Start development environment
docker-compose up

# The API will be available at http://localhost:8787
```

---

## 🏛️ Architecture Overview

```
┌──────────────┐     HTTP/NDJSON      ┌──────────────────┐
│              │  ◄──────────────────► │                  │
│  📱 Mobile   │     Streaming         │  🔥 Hono API     │
│  (Expo)      │                       │  (Port 8787)     │
│              │                       │                  │
└──────────────┘                       └────────┬─────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    │                       │
                              ┌─────▼─────┐          ┌─────▼─────┐
                              │ 🔍 Search │          │ 📝 Summ.  │
                              │   Agent   │          │   Agent   │
                              │(LangGraph)│          │(LangGraph)│
                              └─────┬─────┘          └─────┬─────┘
                                    │                       │
                              ┌─────▼─────┐          ┌─────▼─────┐
                              │  Tavily   │          │  Gemini   │
                              │  Search 🌐│          │  2.0 Flash│
                              └───────────┘          └───────────┘
                                    │
                              ┌─────▼─────┐
                              │ 🗄️ Supabase│
                              │ PostgreSQL │
                              └───────────┘
```

---

## 📂 Individual App READMEs

- [📱 Infynii Mobile App](./apps/infynii/README.md)
- [🔥 Hono API Backend](./apps/hono-api/README.md)
- [📦 Shared Package](./packages/shared/README.md)

---

## 🤝 Contributing

1. Create a feature branch from `main` 🌿
2. Make your changes 🔧
3. Run `pnpm build` to verify everything compiles ✅
4. Open a PR with a description of the changes 🎯
