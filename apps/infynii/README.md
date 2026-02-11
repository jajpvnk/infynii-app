# 📱 Infynii — Mobile App

The Infynii mobile app is a **React Native** application built with **Expo** that provides a chat-based interface for AI-powered web search. Users can ask questions and receive real-time search results with AI-generated summaries. 🧠✨

---

## 🤔 What Does This Do?

This is the **frontend client** of Infynii. It provides:

- 💬 **Chat Interface** — Conversational UI for submitting questions and receiving AI-powered search results
- 🔍 **Real-time Search Results** — Results stream in as the AI agent discovers them via NDJSON
- 📄 **Search Result Details** — Tap any result to view full details and AI-generated summaries
- 🎛️ **Frequency Filters** — Control the search scope using a bottom sheet selector
- 📜 **Auto-scroll** — Automatic scroll-to-bottom when new results arrive

---

## 🏗️ Project Structure

```
infynii/
├── app/                          # 🧭 Expo Router (file-based navigation)
│   ├── (tabs)/                   # Tab navigator
│   │   ├── _layout.tsx           # Tab layout configuration
│   │   ├── index.tsx             # 🏠 Home tab
│   │   ├── chat.tsx              # 💬 Chat tab (main screen)
│   │   └── two.tsx               # Secondary tab
│   ├── searchresult.tsx          # 🔍 Search result detail screen
│   ├── modal.tsx                 # 📋 Modal screens
│   └── _layout.tsx               # Root layout
│
├── screens/                      # 📺 Screen containers
│   ├── ChatScreen.tsx            # Main chat logic and state management
│   └── SearchResultScreen.tsx    # Search result detail view
│
├── components/                   # 🧩 Reusable components
│   ├── chat/                     # Chat-specific components
│   │   ├── ChatInput.tsx         # Message input bar 💬
│   │   ├── FrequencySheet.tsx    # Bottom sheet frequency picker 🎛️
│   │   ├── SearchResultCard.tsx  # Search result preview card 🃏
│   │   └── ...                   # Additional chat widgets
│   ├── Themed.tsx                # Theme-aware base components 🎨
│   └── useColorScheme.ts         # Dark/light mode hook 🌙☀️
│
├── context/                      # 🔌 React Context providers
│   └── HonoProvider.tsx          # API client provider (connects to backend)
│
├── helpers/                      # 🛠️ Helper functions
├── utils/                        # 🔧 Utility functions
│   └── processNDJSONResponse.ts  # NDJSON stream parser 📡
│
├── constants/                    # ⚙️ App-wide constants
│   └── Colors.ts                 # Color palette 🎨
│
├── assets/                       # 🖼️ Static assets
│   ├── images/                   # App images
│   └── fonts/                    # Custom fonts (Inter)
│
├── android/                      # 🤖 Android native project
├── ios/                          # 🍎 iOS native project
├── app.json                      # Expo app configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

---

## 🛠️ Tech Stack

| Component | Tech | Purpose |
|-----------|------|---------|
| Framework | React Native 0.76 | Native mobile development with JavaScript |
| Platform | Expo 52 | Build tooling, OTA updates, managed workflow |
| Navigation | Expo Router 4 | File-based routing for React Native |
| UI Components | @gorhom/bottom-sheet | Bottom sheet interactions |
| Animations | react-native-reanimated 3 | High-performance native animations |
| Icons | lucide-react-native | Consistent icon library |
| Fonts | @expo-google-fonts/inter | Typography |
| API Client | Hono Client | Type-safe API calls with shared types |
| Streaming | react-native-fetch-api | NDJSON streaming support 📡 |

---

## 📱 Screens

### 💬 Chat Screen (Main)
The primary screen where users submit questions. The AI responds with:
- Search result cards that stream in incrementally ⚡
- Status indicators showing agent activity 🔄
- Scroll-to-bottom button for navigating long conversations 📜

### 🔍 Search Result Detail
Displayed when tapping a search result card:
- Full article content 📄
- AI-generated summary on request 📝
- Link to the original source URL 🌐

### 🎛️ Frequency Sheet
A bottom sheet picker for filtering search scope with different frequency options.

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | 📱 Start Expo development server |
| `pnpm ios` | 🍎 Start on iOS simulator |
| `pnpm android` | 🤖 Start on Android emulator |
| `pnpm web` | 🌐 Start web version (experimental) |

### Running from the monorepo root 🌳

```bash
pnpm app:dev           # Start Expo development server
pnpm app:dev:ios       # Run on iOS simulator
pnpm app:dev:android   # Run on Android emulator
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18 🟢
- pnpm >= 10.4.0 📦
- iOS Simulator (Xcode) or Android Emulator (Android Studio)
- Or a physical device with Expo Go 📲

### Running Locally

```bash
# From the monorepo root
pnpm install
pnpm build          # Build shared packages first

# Start the mobile app
pnpm app:dev:ios    # 🍎 iOS
# or
pnpm app:dev:android # 🤖 Android
```

> ⚠️ **Important:** The [Hono API backend](../hono-api/README.md) must be running for the app to function properly.

---

## 🔌 API Connection

The app connects to the Hono API backend via the `HonoProvider` context. The API URL is configured in the app constants and defaults to `http://localhost:8787` during development.

Communication uses **NDJSON** (Newline Delimited JSON) — each line is a separate JSON object parsed on-the-fly by `processNDJSONResponse()`. This enables search results to appear incrementally as they are discovered, rather than waiting for the full response.
