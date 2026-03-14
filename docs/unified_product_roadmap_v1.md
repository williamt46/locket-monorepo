# Locket v1.x.x Product Roadmap: Epics, Stories & Journeys
**From Pre-Production (0.9.x) to Post-Production Alpha (1.x.x)**

This document serves as the single source of truth for bridging the Locket Mobile App, Provider Portal, Partner Portal, and Serverless Gateway from their functional MVPs to a polished, user-tested Alpha.

---

## 1. Product Vision & Goals for 1.x.x
The core 0.9.x infrastructure successfully implemented the `@locket/crypto-engine` (Umbral PRE), Hyperledger Fabric consent anchoring, and isolated data decoding. For the 1.x.x Alpha, our goal is to **humanize the Sovereign Journal experience** by reducing UX friction, increasing robustness in edge cases (e.g., data merging), and enriching the web portals for actual clinical or partner use.

### Goals
- Enhance the UI/UX with the "Sovereign Journal & Digital Ledger" aesthetics.
- Solidify data portability and backup recovery.
- Add contextual interpretation (relational phases) to partner data.
- Ensure end-to-end resilience of the proxy re-encryption pipeline in unpredictable network conditions.

---

## 2. User Personas

1. **The Sovereign User (Alice):** Highly privacy-conscious individual tracking personal health/cycle data. Demands offline capability, absolute control over data access, and an aesthetically premium journal interface.
2. **The Clinical Provider (Dr. Smith):** Needs frictionless adoption of Alice's data. Relies exclusively on standard formats (HL7 FHIR R4) and simple QR-based handshakes.
3. **The Partner (Bob):** Wants limited, read-only insights into Alice's current phase without needing complex healthcare formats—prefers simplified, relatable endpoints.

---

## 3. Epics & User Stories

### Epic 1: Polished "Sovereign Journal" Experience
*Transform the functional mobile app into a premium, accessible daily journaling tool.*

- **Story 1.1:** As a User, I want a Horizontal "Paper" Calendar Navigation component, so I can seamlessly scroll through my history.
- **Story 1.2:** As a User, I want a Data Entry Pop-Up that feels natural and fluid, so logging symptoms takes minimal effort.
- **Story 1.3:** As a User, I want Intelligent Auto-fill for my most common period lengths, so I don't have to manually adjust dates every cycle.
- **Story 1.4:** As a User, I want a dedicated Settings screen that consolidates export, restore, sync, and factory reset actions, so my main Ledger screen remains uncluttered.
- **Story 1.5:** As a User, I want a Light/Dark theme toggle contextually linked to the Sovereign aesthetic, so the app remains comfortable to use at night.
- **Story 1.6:** As a User, I want a prominent, multi-step warning before initiating a "Factory Reset," so I do not accidentally wipe my local SQLite database and keys.

### Epic 2: Advanced Data Recovery & Portability
*Enhance the Phase 9 (AES-GCM-256) backup to be more forgiving for real-world usage.*

- **Story 2.1:** As a User, I want the option to selectively merge an imported backup with my current localized ledger, rather than performing a destructive overwrite (`rawNukeData`).
- **Story 2.2:** As a User imported from legacy apps (Clue/Flo), I want my imported historical data to be automatically encrypted and batch-inscribed into the ledger seamlessly.
- **Story 2.3:** As a User, I want the app to periodically prompt me to export a new `.locket` backup file if I haven't done so recently.

### Epic 3: Partner & Provider Portal Evolution
*Upgrade the Vite React portals (Phase 7 & 8) from MVP data decrypters to contextual dashboards.*

- **Story 3.1:** As a Partner, I want the portal to calculate and display the relational cycle phase (e.g., Follicular, Luteal) next to the raw JSON data, so I have context for the dates being shared.
- **Story 3.2:** As a Provider, I want a "Download FHIR Bundle" button after the data is parsed, so I can seamlessly ingest it into my EHR system.
- **Story 3.3:** As a Provider, I want clear UX error states (empty states, token expiration warnings) when querying `/api/data/request`, so I know exactly why decryption might fail.

### Epic 4: Resilient Edge Sync
*Harden the Serverless Gateway and Sync actions (Phase 6).*

- **Story 4.1:** As a User, I want the `SyncService` to queue offline PRE payloads and upload them automatically when connectivity is restored.
- **Story 4.2:** As a User, I want tactile haptic feedback and a clear success animation when the QR Camera successfully parses the Provider's DID and triggers `grantAccess`.

---

## 4. User Journeys

### Journey 1: Onboarding to First Log (State Diagram)
*Maps the user's flow from establishing the ledger (Phase 3) through creating their first encrypted log.*

```mermaid
stateDiagram-v2
    [*] --> OnboardingWizard
    note right of OnboardingWizard: User sets PERIOD_MIN/MAX and CYCLE parameters
    
    OnboardingWizard --> UserConfigSaved : Save to SecureStore
    UserConfigSaved --> LedgerScreen : Navigate
    
    state LedgerScreen {
        Idle --> DateSelected
        DateSelected --> LogPeriod
        LogPeriod --> PredictionEngine : Calculate next cycle
        PredictionEngine --> LedgerSeeded : first log seeds batch
    }
    
    LedgerScreen --> [*]
```

### Journey 2: QR Consent & Data Decryption (Sequence Diagram)
*Visualizes the integration across Mobile (P6), Gateway (P5), Blockchain (P4), and Portal (P7).*

```mermaid
sequenceDiagram
    autonumber
    participant Alice as "Sovereign User (Mobile)"
    participant Provider as "Provider (Portal)"
    participant Gateway as Serverless Gateway
    participant Fabric as Hyperledger Fabric
    
    Provider->>Alice: Display QR (DID + PubKey)
    Alice->>Alice: Scan QR & select duration (e.g., 24h)
    Alice->>Alice: Generate kFrag (Owner Secret + Provider PubKey)
    Alice->>Gateway: POST /api/consent/grant (kFrag, DID)
    Gateway->>Fabric: Anchor consent hash (Chaincode)
    Fabric-->>Gateway: Tx Validated
    Gateway-->>Alice: Success (Haptic feedback)
    
    Provider->>Gateway: GET /api/data/request (Request Alice's data)
    Gateway->>Gateway: Proxy Re-Encryption (apply kFrag to cFrags)
    Gateway-->>Provider: Return re-encrypted cFrags
    Provider->>Provider: WASM decryptAsRecipient()
    Provider->>Provider: Format as HL7 FHIR R4 Bundle
```

### Journey 3: Backup Exfiltration and Restore (Flowchart)
*Displays the decision tree around Phase 9.1 Sovereign Persistence.*

```mermaid
graph TD
    A["User clicks EXPORT"] --> B{"Has UserConfig?"}
    B -- No --> C["Redirect to Onboarding"]
    B -- Yes --> D["Query SQLite Ledger"]
    
    D --> E["Collect Events & UserConfig"]
    E --> F["AES-256-GCM Envelope Encryption"]
    F --> G["Generate SHA-256 Integrity Hash"]
    G --> H["Create .locket File Blob"]
    H --> I["Save via expo-sharing"]
    
    J["User clicks RESTORE"] --> K["expo-document-picker"]
    K --> L{"Valid Master Key?"}
    L -- No --> M["Reject with UX Warning"]
    L -- Yes --> N{"Tampered Hash?"}
    N -- Yes --> O["Abort Restore"]
    N -- No --> P{"Merge Mode?"}
    
    P -- Overwrite --> Q["rawNukeData() then rawSaveEvents()"]
    P -- Selective --> R["Diff & Batch Inscribe New Events"]
```

---

## 5. Epic and Story Mapping by Persona

Using the `@product-manager-toolkit` frameworks, the following tables organize each story by Persona and assign a **MoSCoW Priority** (Must/Should/Could/Won't Have) alongside the **Success Metric** we will use to measure its impact.

### Persona: The Sovereign User (Alice)
*Experiences the core value of journaling, persistence, and sync. Drives the aesthetic and privacy requirements.*

| Epic | User Story | MoSCoW Priority | Success Metric |
|------|------------|-----------------|----------------|
| **Epic 1:** Polished Experience | 1.1 Horizontal "Paper" Calendar Navigation | **Must Have** | Calendar feature adoption rate |
| **Epic 1:** Polished Experience | 1.2 Data Entry Pop-Up | **Must Have** | Average logs per cycle per user |
| **Epic 1:** Polished Experience | 1.3 Intelligent Auto-fill | **Should Have** | % of cycles using auto-fill settings |
| **Epic 1:** Polished Experience | 1.4 Dedicated Settings screen | **Must Have** | Decrease in LedgerScreen clutter |
| **Epic 1:** Polished Experience | 1.5 Light/Dark theme toggle | **Should Have** | % of DAU interacting with the toggle |
| **Epic 1:** Polished Experience | 1.6 "Factory Reset" warning | **Must Have** | 0 accidental DB wipes in telemetry |
| **Epic 2:** Advanced Recovery | 2.1 Selectively merge backups | **Must Have** | Successful uncorrupted merge rate |
| **Epic 2:** Advanced Recovery | 2.2 Import from Clue/Flo | **Should Have** | Volume of imported historical CSVs |
| **Epic 2:** Advanced Recovery | 2.3 Periodic backup prompts | **Could Have** | % of MAU possessing recent backups |
| **Epic 4:** Resilient Sync | 4.1 Queue offline PRE payloads | **Must Have** | 100% sync success after reconnect |
| **Epic 4:** Resilient Sync | 4.2 Haptic feedback on QR scan | **Should Have** | Positive CSAT on QR consent flow |

---

### Persona: The Clinical Provider (Dr. Smith)
*Consumes Alice's data through the portal. Needs FHIR R4 formatting and robust error states.*

| Epic | User Story | MoSCoW Priority | Success Metric |
|------|------------|-----------------|----------------|
| **Epic 3:** Portal Evolution | 3.2 "Download FHIR Bundle" | **Must Have** | Total downloaded generic FHIR bundles |
| **Epic 3:** Portal Evolution | 3.3 Clear UX error states | **Must Have** | Drop in provider support queries |

---

### Persona: The Partner (Bob)
*Views interpreted, relational cycle phases through a simplified web experience without dense clinical data.*

| Epic | User Story | MoSCoW Priority | Success Metric |
|------|------------|-----------------|----------------|
| **Epic 3:** Portal Evolution | 3.1 Display relational cycle phase | **Must Have** | Daily active usage of Partner Portal |
