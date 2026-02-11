# 📦 Infynii Shared Package

`@jpvnk/infynii-shared` contains the **shared TypeScript types and utilities** used by both the mobile app and the backend API. It serves as the single source of truth for data structures, ensuring type consistency across the entire stack. 🤝

---

## 🤔 What Does This Do?

This package provides:

- 🏷️ **Shared TypeScript types** — Message formats, search results, API responses
- 🗄️ **Database schema types** — Auto-generated Supabase types (`db-schema.ts`)
- 🤖 **LangGraph state definitions** — Agent state annotations for the backend
- 📊 **Status enums** — Graph execution statuses shared across the stack

---

## 🏗️ Project Structure

```
shared/
├── src/
│   ├── index.ts           # 📤 Core exports (messages, search results, responses)
│   ├── server.ts          # 🖥️ Server-only exports (LangGraph state annotations)
│   ├── search.ts          # 🔍 Search-related types
│   ├── graph.ts           # 📊 Graph execution status enums
│   ├── summarize.ts       # 📝 Summarization types
│   ├── utils.ts           # 🔧 Shared utility functions
│   └── db-schema.ts       # 🗄️ Auto-generated Supabase database types
│
├── dist/                  # 📦 Compiled JavaScript + type declarations
├── tsconfig.json          # TypeScript configuration
└── package.json           # Package metadata
```

---

## 🏷️ Key Types

### Core Types (`index.ts`)

| Type | Description | Used By |
|------|-------------|---------|
| `TSerializedMessage` | Chat message format for API communication | Frontend + Backend |
| `TTavilySearchResult` | Search result with title, URL, score, and preview | Frontend + Backend |
| `TSearchChatResponse` | Full API response shape for search streaming | Frontend + Backend |

### Search Types (`search.ts`)

| Type | Description |
|------|-------------|
| Search frequency types | Search scope option definitions 🎛️ |
| Search metadata types | Result metadata structures 📋 |

### Graph Status (`graph.ts`)

| Type | Description |
|------|-------------|
| `TGraphStatus` | Enum of execution states (idle, running, complete, error) 📊 |

### Summarize Types (`summarize.ts`)

| Type | Description |
|------|-------------|
| `TSummarizeResponse` | Summarization API response shape 📝 |

### Server-Only Types (`server.ts`)

| Type | Description |
|------|-------------|
| `RootGraphState` | LangGraph search agent state annotation 🔍 |
| `SummarizeGraphState` | LangGraph summarize agent state annotation 📝 |

> ⚠️ Server types import LangGraph dependencies — only use `@jpvnk/infynii-shared/server` in the backend.

---

## 📤 Exports

The package uses **conditional exports** to separate client-safe and server-only code:

```typescript
// ✅ Safe for both frontend and backend
import { TSerializedMessage, TTavilySearchResult } from "@jpvnk/infynii-shared"

// ⚠️ Server-only (imports LangGraph)
import { RootGraphState } from "@jpvnk/infynii-shared/server"
```

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | 🏗️ Compile TypeScript (`tsc`) |

### From the monorepo root 🌳

```bash
pnpm build       # Builds all packages including shared
pnpm gentypes    # Regenerate Supabase types into db-schema.ts 🧬
```

---

## 🔄 Regenerating Database Types

When the Supabase database schema changes, regenerate the types:

```bash
# From the monorepo root
pnpm gentypes
```

This runs `supabase gen types typescript --local` and outputs to `src/db-schema.ts`. This file should not be edited manually — it will be overwritten on the next generation.

---

## 🛠️ Tech Stack

| Component | Tech |
|-----------|------|
| Language | TypeScript 5.3 |
| Module System | ESM (`"type": "module"`) |
| Build | `tsc` (no bundler required) |
| Dependencies | `@langchain/langgraph`, `@langchain/core` (server exports only) |
