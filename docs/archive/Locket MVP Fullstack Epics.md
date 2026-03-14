

## **1\. Project Context & Philosophy**

* **The Problem:** Users fear reproductive health data stored in the cloud can be subpoenaed or sold. Users feel they do not have ownership of their health data or control over how it is shared or used by the company when they agree to privacy terms.  
* **The Solution:** A "Local-First" architecture. The data lives **encrypted** on the user's device. The server *never* sees the data or the decryption key. The server only receives a cryptographic **Hash** to anchor on the blockchain for integrity verification. GDPR and HIPAA compliance is built-in as a **feature** through **smart contracts.**  
* **Core Value:** "Digital Ink that never leaves your phone." This suggests permanence and locality.  
* **Compliance Strategy:**  
1. **GDPR:** Satisfied via Crypto-Shredding. If the user deletes their local key, the data is mathematically erased forever.  
2. **HIPAA:** Satisfied by Data Minimization. The server never touches PHI (Protected Health Information), so it cannot leak it.

## **2\. The Vertical Slice Definition (The "Walking Skeleton")**

*Referencing the "Vertical Slice" methodology:* We will not build the settings menu, the fancy charts, or the user profile yet. We will build **one complete data pathway** from the mobile input field to the Hyperledger Fabric ledger and back.

### **The Stack**

* **Frontend:** React Native (Expo) \- Focused on a single "Log Data" screen.  
* **Local Persistence:** SQLite (via Expo FileSystem) \- Stores the *encrypted* blob.  
* **Encryption Layer:** Web Crypto API (Client-Side). Algorithm: AES-GCM 256\.  
* **Middleware:** Node.js API Gateway (Lightweight Express).  
* **Backend:** Hyperledger Fabric Test Network (1 Org, 1 Channel).

## **3\. Epic Breakdown: The "Integrity Anchor"**

### **Epic 1: The Zero-Knowledge Write Path (High Priority)**

*Focus: Prove we can secure data without holding it.*

**User Story 1.1: The Local Encryption Event**

* **Context:** The user inputs "Cycle Start Date: 2025-01-01".  
* **Action:**  
  1. Frontend generates a local symmetric key (stored in SecureStore).  
  2. Frontend encrypts the payload `{"event": "period_start", "date": "2025-01-01"}`.  
  3. Frontend generates a SHA-256 hash of the *encrypted* payload.  
  4. Frontend saves the encrypted payload to local SQLite.  
* **Deliverable:** A functional React Native component that accepts text input and logs the resulting Ciphertext and Hash to the console.

**User Story 1.2: The Blockchain Anchor**

* **Context:** The app needs to prove this data existed at this time without revealing what it is.  
* **Action:**  
  1. Frontend sends `POST /api/anchor` with body `{ userDID: "did:fem:123", dataHash: "0xABC..." }`. **CRITICAL:** Do not send the ciphertext or the key.  
  2. API Gateway invokes Hyperledger Fabric Chaincode: `CreateAsset(AssetID, UserDID, DataHash)`.  
  3. Chaincode records the transaction immutably.  
* **Deliverable:** A Node.js endpoint connected to a local Fabric testnet that successfully commits the hash.

### **Epic 2: The Verification Read Path (Medium Priority)**

*Focus: Closing the loop to prove integrity.*

**User Story 2.1: The Integrity Check**

* **Context:** The user opens the app, and the app verifies the local data hasn't been tampered with (e.g., by malware or a modified app binary).  
* **Action:**  
  1. Frontend retrieves the local encrypted blob.  
  2. Frontend recalculates the SHA-256 hash.  
  3. Frontend queries `GET /api/verify/{AssetID}`.  
  4. API Gateway queries Chaincode state.  
  5. Frontend compares Local Hash vs. On-Chain Hash.  
  6. **UI Feedback:** Display a "Green Shield" icon if they match, or a "Red Warning" if they differ.  
* **Deliverable:** The complete round-trip logic displaying the integrity status on the mobile screen.

### **Epic 3: The "Right to Erasure" (crypto-shredding) (Medium-low priority)**

*Focus: Enforcing GDPR Article 17 without server trust.*

**User Story 3.1: The Kill Switch**

* **Context:** The user wants to delete their account/data.  
* **Action:**  
  1. User clicks "Delete Wallet" in the app.  
  2. App deletes the Private Key from the device's Secure Enclave.  
  3. App drops the local SQLite table.  
  4. **Cloud Tier:** App revokes all active Consent Tickets on Hyperledger and deletes encrypted backup blobs from the user's cloud (if permissions allow).  
  5. Result: The hashes on the blockchain remain, but they are now mathematically orphaned and the data is gone from all Locket-connected services.  
* **Deliverable:** A unit test proving that data recovery is impossible after key deletion and cloud revocation.

### **Epic 4: Portability & Interoperability (SaaS Tier)**

*Focus: Securely extending data access to medical providers using HL7 FHIR.*

**User Story 4.1: The HL7 FHIR Consent Grant**

- **Context:** The user wants to share their cycle history with a doctor.  
- **Action:**  
  1. Frontend creates a "Consent Ticket" on Hyperledger (ProviderID, DataURI, Expiry). This ticket allows the Locket Gateway to authorize future requests from that Provider.  
  2. Frontend transforms local health logs into **HL7 FHIR Observation** resources and uploads them encrypted to the user's cloud.  
- **Deliverable:** Verification of a valid FHIR payload generated and anchored.

**User Story 4.2: The Zero-Knowledge Proxy Gate**

- **Context:** A doctor needs to view the shared data.  
- **Action:**  
  1. Gateway receives a request from a Provider (authenticated via standard API key/dashboard).  
  2. Gateway queries Hyperledger to verify a valid, non-expired Consent Ticket for that ProviderID.  
  3. Gateway fetches the *encrypted* FHIR blob from the user's cloud.  
  4. Gateway serves the blob (ciphertext) to the Provider.  
- **Deliverable:** A serverless API endpoint that permits/denies access based on ledger state.

### **Epic 5: Sovereign Persistence (SaaS Tier)**

*Focus: Ensuring data longevity and mobility.*

**User Story 5.1: Encrypted Cloud Backup (BYO Cloud)**

- **Context:** User wants to protect against lost devices.  
- **Action:**  
  1. App encrypts the local database blob (AES-GCM-256).  
  2. App uploads the blob to the user's personal Google Drive/iCloud.  
  3. App anchors the backup hash on Hyperledger for recovery integrity.  
- **Deliverable:** Automated background sync to a user-controlled cloud storage.

**User Story 5.2: Structured Data Import**

- **Context:** User migrating from Clue or Flo.  
- **Action:**  
  1. User uploads a CSV/JSON export.  
  2. App parses the data client-side and maps it to Locket's FHIR-aligned schema.  
- **Deliverable:** Successful ingestion of a legacy data file without server exposure.

## **4\. Security, Compliance & Supply Chain Constraints (Strict)**

* **Compliance Pillars:**  
  1. **HL7 FHIR:** All shared health data must conform to FHIR R4 standards.  
  2. **HIPAA:** Serverless Gateway must never touch unencrypted PHI.  
  3. **GDPR:** Consent grants on Hyperledger must be time-bound and revocable.  
* **No Forking:** Do not fork an existing period tracker repo. We are composing from scratch to avoid the "Nebraska Problem" (hidden vulnerabilities in abandoned dependencies).  
* **Dependency Audit:** Before writing code, configure `npm audit` to fail the build on any distinct vulnerability.  
* **Zero Analytics:** Explicitly block the installation of Google Analytics, Firebase Crashlytics, or any third-party SDKs that "phone home."  
* **Open Source Crypto:** All encryption logic must be in a separate, clean file (CryptoService.js) that is readable and auditable.  
* **Local-Only State:** The app must function 100% offline. Network calls are only for syncing hashes to the blockchain.

## **5\. Immediate Execution Plan**

**Step 1:** Initialize the local Hyperledger Fabric network (Test Network script). **Step 2:** Define the Chaincode structure (Go or Node.js) to accept only `UserDID`, `Timestamp`, and `Hash`. **Step 3:** Initialize the Expo (React Native) app and implement the `Web Crypto` encryption utility function. **Step 4:** Wire the "Log Data" button to the Fabric SDK.

---

**Strategic Note for the AI:** Do not build authentication screens yet (use a hardcoded DID for the MVP). Do not build data visualization. Focus entirely on the cryptography and the ledger transaction. If the hash doesn't anchor, the product fails.  
