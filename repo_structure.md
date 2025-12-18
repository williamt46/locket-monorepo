# Repository Structure: locket-monorepo

## 🌿 Branches
*   **`feature/ui-refinement`** *(Current Branch)*: Contains the latest UI changes including the new Ledger layout, Auth screen updates, and cycle logic.
*   **`main`**: The stable base branch.
*   **`origin/main`**: Remote tracking branch for main.
*   **`origin/feature/ui-refinement`**: Remote tracking branch for the new feature.

## 📦 Component Overview

The repository is structured as a **Monorepo** containing four main components:

### 📱 `locket-app/` (Mobile Application)
*   **Purpose**: The primary mobile interface for users (React Native/Expo).
*   **Key Directories**:
    *   `src/components/`: Reusable UI elements (e.g., `WinslowGrid`, `CycleLengthTable`, `IntegritySeal`).
    *   `src/screens/`: Main application screens (`AuthScreen`, `LedgerScreen`).
    *   `src/navigation/`: App navigation logic (`AppNavigator`).
    *   `src/theme/`: Design tokens (`colors`, `typography`, `layout`).

### 🌐 `locket-web/` (Web Client)
*   **Purpose**: A web-based interface for the application (React/Vite).
*   **Key Files**:
    *   `src/LogDataScreen.jsx`: Screen for logging data via verifying keys.
    *   `src/services/`: Client-side logic including key persistence.
    *   `src/main.jsx`: Entry point.

### 🔗 `locket-gateway/` (API Gateway)
*   **Purpose**: The backend service connecting clients to the blockchain network.
*   **Key Files**:
    *   `src/app.js`: Main Express application entry point.
    *   `src/fabricClient.js`: Logic for interacting with the Hyperledger Fabric SDK.
    *   `src/enrollAdmin.js` & `src/registerUser.js`: Identity management scripts.

### ⛓️ `locket-network/` (Blockchain Network)
*   **Purpose**: Infrastructure and smart contracts (Hyperledger Fabric).
*   **Key Directories**:
    *   `chaincode/`: The smart contract logic (`index.js`).
    *   `fabric-samples/`: Standard Fabric network scripts and configuration context.
    *   `start-network.sh`: Script to initialize the local blockchain environment.

### 📂 Root Files
*   `verify-flow.js`: End-to-end verification script.
*   `wallet/`: Directory for local crypto identities (`admin.id`, `appUser.id`).
