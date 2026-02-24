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

## � Mobile Development

The mobile app is built with Expo and requires native environment setup for iOS (Xcode) and Android (Android Studio).

### 🍏 iOS Development

#### Simulator
Run the app on the latest iOS simulator:
```bash
cd apps/mobile
npx expo run:ios
```

#### Physical Device
1.  Connect your iPhone via USB.
2.  Enable **Developer Mode** on your iPhone 
3.  Open the workspace in Xcode to configure signing:
    ```bash
    open apps/mobile/ios/locketapp.xcworkspace
    ```
4.  In Xcode, select the **locketapp** project -> **Signing & Capabilities** -> Select your **Team**.
5.  Run the build command:
    ```bash
    npx expo run:ios --device
    ```

### 🤖 Android Development

#### Emulator
Ensure an Android Virtual Device (AVD) is running, then execute:
```bash
cd apps/mobile
npx expo run:android
```

#### Environment Variables
Ensure your `JAVA_HOME` is set to **Java 17** (required for Gradle compatibility).

## �🛠️ Monorepo Workflow
- **Shared Code**: Reusable logic (like crypto and types) lives in `packages/shared`.
- **Atomic Changes**: PRs can safely touch both shared logic and its usage in applications.
- **Task Pipelines**: Use `turbo` to run commands efficiently across the workspace.


## ⛓️ Blockchain Network

The local developer network uses Hyperledger Fabric.

### Prerequisites
- **Docker & Docker Compose**: Ensure Docker Desktop is running.

### Start the Network
This script will bring down any existing network, start the Fabric test network with a Certificate Authority (CA) and CouchDB, and deploy the chaincode.

```bash
cd network
./start-network.sh
```

## 🔒 Security

### Dependency Management
This project prioritizes software supply chain security. All dependencies are regularly audited using the **Sonatype MCP** tools to identify and mitigate vulnerabilities.

*   **Audit Frequency**: Continuous scanning during development.
*   **Scanning Tools**: Sonatype OSS Index via Model Context Protocol (MCP).
*   **Resolution Strategy**: Prioritize upgrading to the "Latest Secure" versions recommended by Sonatype intelligence.

### Verified Security Patches (January 2026)
*   **API Gateway**: `body-parser` updated to `>2.2.2` (DoS mitigation).
*   **Mobile App**:
    *   `expo` SDK updated to secure patch levels.
    *   `@react-native-community/cli` updated to `>20.0.0` (RCE mitigation).

### Vulnerability Reporting
If you discover a security vulnerability within this project, please report it immediately to the maintainers. Do not disclose sensitive information publicly until a patch has been released.
