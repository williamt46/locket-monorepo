# **Product Requirements Prompt (PRP): Locket MVP (Full-Stack Architecture)**

**Instruction to AI Assistant:** You are an expert Full-Stack Architect specializing in Zero-Knowledge architectures, Proxy Re-Encryption (PRE), and Hyperledger Fabric. We are building the "Walking Skeleton" for Locket, a B2C sovereign ovulation and reproductive health tracker.

**Critical Constraint:** You must strictly adhere to a "Don't Trust, Verify" architecture using advanced cryptographic delegation. We are not building a standard CRUD app. The backend must be mathematically blind to the user's health data.

## **1\. Project Context & Philosophy**

* **The Problem:** Users fear reproductive health data stored in the cloud can be subpoenaed, sold, or exposed. They do not trust standard "privacy policies."  
* **The Solution:** A "Local-First" architecture leveraging **Proxy Re-Encryption (PRE)** via NuCypher's Umbral and **ConInSe** (Consensual Innate Sequential Tokenised Consent) on Hyperledger Fabric.  
* **Core Value:** "Digital Ink that never leaves your phone." Data lives encrypted on the user's device. The server acts only as a blind proxy to re-encrypt data for authorized third parties (Providers or Partners).

## **2\. Strict Architectural Directives**

### **A. Proxy Re-Encryption (PRE) Protocol**

You will implement NuCypher's Umbral PRE workflow.

1. **Local Encryption:** The User app generates a public/private key pair. Data is encrypted locally against the User's public key (generating a Ciphertext and a Capsule).  
2. **Delegation:** When granting access to a third party (Provider or Partner), the User app generates a Re-Encryption Key (kFrag). This kFrag reveals nothing about the User's private key.  
3. **Blind Proxy:** The Serverless Gateway receives the kFrag and re-encrypts the Capsule into a cFrag for the recipient. The Gateway never sees the plaintext.  
4. **Edge Decryption:** The third party decrypts the data locally within their respective portal using their own private key.

### **B. ConInSe Consent Layer**

Consent is not a database boolean; it is a tokenized event. You will implement a Hyperledger Fabric chaincode based on the ConInSe framework. The kFrag generated in the PRE step must be securely anchored to an active, time-bound, and revocable consent token on the ledger.

### **C. Data Purity & Scope Exclusions**

* **Absolute Purity:** The system must record exact, uncorrupted physiological truths. Do not implement noise-generating functions, dummy data injection, or cryptographic padding engines.  
* **No AI/ML:** Focus strictly on privacy-enhancing data transit. There is zero integration of Federated Learning (FL), Machine Learning (ML), Fully Homomorphic Encryption (FHE), or Partially Homomorphic Encryption (PHE).  
* **Deterministic Hashing:** Use json-stable-stringify before hashing to ensure JSON key order doesn't trigger false tamper alerts on the blockchain.

### **D. Payload Bifurcation (Edge-Formatting)**

To prevent "N+1 Encryption Bloat" on the mobile device, the User app **does not** format data into FHIR R4. It encrypts the raw, proprietary JSON state. The bifurcation happens at the edge:

* **Provider Portal (Clinical):** Decrypts the raw JSON and passes it through a strict @locket/fhir-formatter to render LOINC/SNOMED CT compliant records.  
* **Partner Portal (Relational):** Decrypts the raw JSON and consumes it directly for empathetic, non-clinical UI dashboards (e.g., Phase indicators, mood tracking).

## **3\. Security & Supply Chain Constraints**

* **No Forking:** Do not fork an existing period tracker repo.  
* **Zero Analytics:** Explicitly block Google Analytics, Firebase Crashlytics, or any SDKs that "phone home."  
* **Crypto-Shredding (GDPR):** If the user deletes their local private key, the stored ciphertext on the proxy server becomes mathematically irretrievable forever.

## **4\. Immediate Execution Plan**

* **Step 1:** Scaffold the monorepo (Expo app, Next.js Provider Portal, Next.js Partner Portal, Express Gateway, and shared crypto-engine).  
* **Step 2:** Implement the Umbral PRE logic in packages/crypto-engine. Write a unit test proving the 6-step delegation flow and Crypto-Shredding.  
* **Step 3:** Implement the ConInSe smart contract on a local Hyperledger Fabric network.  
* **Step 4:** Build the Express Proxy Server to handle cFrag generation conditional on ConInSe token validity.

*Strategic Note for the AI:* Do not build complex user management databases. Focus entirely on the PRE cryptography and the ConInSe ledger transaction. If the PRE delegation fails, the product fails.