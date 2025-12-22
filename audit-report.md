### **Audit Report: The State of the Locket "Walking Skeleton"**

**Prepared By:** Gemini 3

**Project:** Locket MVP (Sovereign Journal Framework) 

**Objective:** Evaluation of "Don't Trust, Verify" implementation and GTM readiness.

---

### **1. Executive Summary**

The current Locket codebase is a "Split Personality" system. While the **UI ("The Face")** is visually polished and fulfills the "Digital Ledger" aesthetic, the **Backend ("The Brain")** is a disconnected prototype plagued by architectural shortcuts. To achieve a **cryptographically secured UI**, the application must move beyond "demo-first" logic where data is volatile and hashes are non-deterministic.

**Core Finding:** The app is currently **0% Integrated**. The high-fidelity ledger does not persist data to the secure storage layer, and the storage layer itself contains "Critical-Zero" vulnerabilities.

---

### **2. Forensic Audit of AI Implementation Shortcuts**

The "Antigravity" AI’s motivation was clearly to produce a visual "UX Demo". Its internal comments reveal a systematic prioritization of appearance over the "Don't Trust, Verify" architecture.

#### **A. The Hashing Bug (Integrity Debt)**

* **AI Observation:** `// JSON.stringify on objects is not guaranteed deterministic (key order). But for MVP... let's trust it...`.
* **Architectural Critique:** This is a fatal flaw for GTM. In a Zero-Knowledge system, if the stringification order changes, the hash changes, triggering false "TAMPER DETECTED" alerts.
* **Impact:** User trust is destroyed when the interface behaves inconsistently.
* **Remediation:** We must implement Canonical Serialization. We cannot rely on standard JSON serialization.

#### **B. The Storage Time Bomb (Scalability Debt)**

* **AI Observation:** `// Saves an encrypted event blob... Appends to an array...`.
* **AI Observation:** // Saves an encrypted event blob... Appends to an array.... 			     
* **Current State:** The flat-file events.json architecture creates a performance "Time Bomb" (O(N) complexity) and exposes a critical side-channel vulnerability: attackers can infer menstrual cycles via filesystem timestamps, rendering payload encryption moot.
* **Objective:** Achieve true "At-Rest Privacy" and O(log N) performance by obscuring both data content and write patterns.
* **Remediation:** We will migrate to SQLCipher (Page-Level Encryption) to encrypt the entire database structure, hiding indices from the OS. Simultaneously, we will implement Traffic Padding (Dummy Writes) to generate random noise, defeating metadata traffic analysis.
* **Action:** Immediate destruction of JSON storage and implementation of the encrypted SQLite schema.


#### **C. Main-Thread Hijacking (Performance Debt)**

* **AI Observation:** `// MADE SYNCHRONOUS for easier UI usage... Let's check: QuickCrypto.createDecipheriv is sync. So we can remove async.`.
* **Architectural Critique:** Forcing heavy cryptographic operations to be synchronous blocks the UI thread.
* **Impact:** The app will freeze ("dropped frames") every time a user "Inscribes the Ledger," violating the requirement for a "100% responsive" local-first experience.
* **Remediation:** We need to offload crypto to the JSI (JavaScript Interface) or C++ bindings.



#### **D. The "Potemkin" Ledger (Persistence Debt)**

* **AI Observation:** `// Generate specific predictions for demo when component mounts... Mock 5 days of predicted period`.
* **Architectural Critique:** The beautiful calendar view is a visual facade. It uses `useState` for data, meaning all "inscribed" notes and periods evaporate when the app is closed.
* **Impact:** The app behaves like a toy rather than a permanent "physical book".



---

### **3. The Path to 100% Integration**

To reach 100% readiness, we must bridge the gap between "Digital Ink" and the "Blockchain Anchor".

| Feature | Current Prototype State | Goal for 100% Integration |
| --- | --- | --- |
| **Data Persistence** | `useState` (Volatile) | **SQLite Database + SQLCipher + Traffic Padding.** Encrypted-at-rest DB with dummy writes to mask metadata patterns. |
| **Integrity Anchor** | Non-deterministic JSON | **Canonical Serialization.** Guaranteed deterministic hashes. |
| **UI Responsiveness** | Synchronous Blocking | **Asynchronous Worklets.** Crypto off-loaded from the main thread. |
| **Sync Philosophy** | Manual Trigger | <br>**Optimistic Background Queue.** Instant UI updates with silent anchoring.

 

---

### **4. Comparative Product Roadmaps**

#### **Roadmap A: The Investor Demo (Current Trajectory)**

* **Focus:** Immediate visual integration using existing shortcuts.
* **GTM Effectiveness:** **Low.** Verification fails randomly; performance degrades within months.

#### **Roadmap B: The Sovereign Architect (Security First)**

* **Focus:** Complete refactor of storage (SQLite) and crypto before UI connection.
* **GTM Effectiveness:** **High Trust/Slow Progress.** Delays GTM by 4-6 weeks for "invisible" backend stability.


### **Proposed Roadmap C: "The Iterative Privacy-First Architect"**

This roadmap aims to bridge the gap between the "Demo" (Roadmap A) and the "Total Refactor" (Roadmap B) by focusing on functional vertical slices.

**1. Phase 1: The Deterministic Core (Week 1)**

* **Objective:** Stabilize the Hash. Replace standard `JSON.stringify` in `CryptoService.js` with a canonical serialization library to ensure identical inputs always produce identical hashes.**Code Standard:** Input → Sort Keys → Serialize → Hash. This ensures that Hash(A)≡Hash(A) forever, regardless of the runtime environment.

* **Asynchronous Migration:** Re-implement `encryptData` and `decryptData` as true async functions using Web Workers or Expo JSI to ensure the UI remains buttery smooth.

* **Constraint:** You are forbidden from writing any new UI code until a unit test passes where `{a:1, b:2}` and `{b:2, a:1}` produce the exact same SHA-256 hash.

**2. Phase 2: The SQLite Transition (Week 2)**

* **Objective:** Replace the volatile `useState` system with a persistent, encrypted relational database.
* **Action:** We will implement SQLite wrapped in SQLCipher for page-level encryption. A Relational Schema is mandatory to structure data for efficient O(log N) retrieval inside the encrypted file. We will implement a `useLedger` hook to abstract these SQL queries from the UI. The schema will also support Traffic Padding, allowing background injection of dummy rows to mask usage patterns. This secures data at rest while ensuring the calendar UI remains responsive.
* **Constraints:** Direct file system I/O (reading/writing JSON) is forbidden. The UI thread must never perform decryption; all database interaction must occur asynchronously via the `useLedger` hook.
* **Critical Details:**  The `date` column must be indexed inside the encrypted SQLCipher container to enable instant range queries without decrypting the entire dataset. Dummy rows must be cryptographically indistinguishable from real user entries.



**3. Phase 3: The Background Anchor (Week 3)**

* **Objective:** Background synchronization to Hyperledger.

*  **Optimistic Sync Engine:** Implement a background queue that saves to local SQLite instantly (triggering the "Closing the Clasp" animation) and anchors to Hyperledger Fabric in the background.

* **Logic:**
    * User taps -> UI updates instantly (Optimistic).
    * Data writes to local SQLite (Persistent).
    * Background job picks up unsynced rows -> Anchors Hash to Blockchain -> Updates sync_status to "Anchored".


* **Integrity Verification:** Wire the "Integrity Seal" component to a real verification service that compares local hashes with the blockchain state fetched from the gateway.

---

### **5. Final Conclusion**

**"User trust is built by the interface behaving consistently"**. Locket's success depends on the user feeling that their data is as permanent as "Digital Ink that never leaves your phone". We must move to **Roadmap C** to ensure that when the user "closes the clasp," the underlying architecture actually secures it permanently, deterministically, and invisibly.



