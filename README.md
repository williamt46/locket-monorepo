# Locket Monorepo

Welcome to the Locket monorepo. This project is a local-first health tracker with blockchain-anchored integrity.

## 🏗️ Technical Architecture
This repository uses a monorepo structure managed by **npm workspaces** and **Turborepo** for efficient development and build orchestration.

## 🌿 Branches
*   **`data-persistent-ledger-architecture`** *(Current Branch)*: Contains the latest monorepo restructuring and persistent ledger state.
*   **`main`**: The stable base branch.
*   **`origin/main`**: Remote tracking branch for main.
*   **`origin/data-persistent-ledger-architecture`**: Remote tracking branch for the current architecture branch.

## 📦 Component Overview

The repository is structured as a **Monorepo** containing applications, shared packages, and infrastructure:

### 📱 `apps/mobile/` 
*   **Purpose**: The primary mobile interface for users (React Native/Expo).
*   **Key Directories**:
    *   `src/components/`: Reusable UI elements (e.g., `WinslowGrid`, `CycleLengthTable`, `IntegritySeal`).
    *   `src/screens/`: Main application screens (`AuthScreen`, `LedgerScreen`).
    *   `src/navigation/`: App navigation logic (`AppNavigator`).
    *   `src/theme/`: Design tokens (`colors`, `typography`, `layout`).

### 🌐 `apps/web/`
*   **Purpose**: A web-based interface for the application (React/Vite).
*   **Key Files**:
    *   `src/LogDataScreen.jsx`: Screen for logging data via verifying keys.
    *   `src/services/`: Client-side logic including key persistence.
    *   `src/main.jsx`: Entry point.

### 🔗 `apps/gateway/` 
*   **Purpose**: The backend service connecting clients to the blockchain network.
*   **Key Files**:
    *   `src/app.js`: Main Express application entry point.
    *   `src/fabricClient.js`: Logic for interacting with the Hyperledger Fabric SDK.
    *   `src/enrollAdmin.js` & `src/registerUser.js`: Identity management scripts.

### 📦 `packages/shared/` (Shared Library)
*   **Purpose**: Common utilities, types, and constants shared across applications.
*   **Key Files**:
    *   `src/constants.ts`: Shared constants (e.g., Encryption Algorithm, IV Length).
    *   `src/types.ts`: Shared TypeScript interfaces (`LedgerEntry`, `EncryptedPayload`).
    *   `src/index.ts`: Main export file.

### ⛓️ `network/` 
*   **Purpose**: Infrastructure and smart contracts (Hyperledger Fabric).
*   **Key Directories**:
    *   `chaincode/`: The smart contract logic (`index.js`).
    *   `fabric-samples/`: Standard Fabric network scripts and configuration context.
    *   `start-network.sh`: Script to initialize the local blockchain environment.

### 📂 Root Files
*   `verify-flow.js`: End-to-end verification script.
*   `wallet/`: Directory for local crypto identities (`admin.id`, `appUser.id`).
*   `package.json`: Root configuration defining workspaces.
*   `turbo.json`: Turborepo configuration for build orchestration.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Development
Start all services in development mode:
```bash
npm run dev
```

### Build
Build all packages and applications:
```bash
npm run build
```

## 🛠️ Monorepo Workflow
- **Shared Code**: Reusable logic (like crypto and types) lives in `packages/shared`.
- **Atomic Changes**: PRs can safely touch both shared logic and its usage in applications.
- **Task Pipelines**: Use `turbo` to run commands efficiently across the workspace.

