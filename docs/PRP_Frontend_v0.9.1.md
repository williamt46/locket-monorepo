# **Product Requirements Prompt (PRP): Locket MVP Frontend**

**Instruction to AI Assistant:** You are a Senior Product Designer and Frontend Architect specializing in User-Centered Design (UCD) and React Native (Expo). We are building the frontend for Locket, a local-first, zero-knowledge reproductive health tracker.

**Core Design Philosophy:** The application must reject the sterile, clinical aesthetic of standard medical apps and the "pink/flowery" tropes of FemTech. Instead, it must embody the "Sovereign Journal" and "Digital Ledger" metaphors. The user experience should feel like writing in a private, leather-bound notebook with permanent ink.

**Critical Constraint:** You must translate complex cryptographic proxy re-encryption (PRE) and blockchain consent (ConInSe) into intuitive, physical metaphors. Do not use technical jargon (e.g., "kFrag", "Ciphertext", "Hash") in the UI.

## **1\. Project Context & User Psychology**

* **The User Need:** Users are retreating to pen-and-paper tracking out of fear that their digital data will be surveilled or weaponized. They do not trust standard "Cloud" sync features.  
* **The Terminology:** The person using the app is a "User" or "Data Owner". **Never** refer to them as a "Patient" in the UI. This is a sovereign tool, not a clinical prescription.  
* **The Aesthetic:** "Digital Ink." The UI relies on physical, un-deletable visual metaphors. (Refer to Section 5 for exact design tokens).  
* **The Metaphors:** \* Authentication \= "Opening the Locket"  
  * Data Entry \= "Inscribing the Ledger"  
  * Granting Access \= "Providing a Key"

## **2\. Epics: The "Sovereign Journal" Framework**

### **Epic 1: The Local-First Ledger (Data Entry)**

* **Goal:** A beautiful, responsive calendar (Astrolabe/Chronograph) for logging flow, symptoms, and cycle configuration.  
* **Data Purity:** The UI must reflect exact, uncorrupted truths. Do not implement UI elements that "fuzz" or pad the user's data. What they inscribe is exactly what is stored.  
* **No Predictive AI:** The app calculates standard biological phase boundaries (Menstrual, Follicular, Ovulation, Luteal) based on basic math. Do not design UI for "Machine Learning Insights" or "Federated Learning."

### **Epic 2: Multi-Party Consent Generation**

* **Goal:** A secure flow for delegating access to third parties via QR code scanning.  
* **Context:** When the user scans a third party's QR code (containing their Public Key and DID), the app generates a cryptographic permission slip (a kFrag).  
* **Bifurcated Audiences:** The UI must allow the user to easily distinguish between sharing with a **Provider** (Clinical view) and a **Partner** (Relational/Read-only view).  
* **Visualizing ConInSe:** Consent is a time-bound token. The UI must show an "Active Keys" dashboard where users can instantly revoke access, triggering a blockchain revocation event.

## **3\. Technical Implementation Rules**

1. **React State & Timezones:** Cycle mathematical logic must strictly utilize UTC normalization (getUTCDate) to prevent timezone drift across locales.  
2. **UI over Algo:** The app must feel 100% responsive offline. Network calls to the Proxy Server happen silently in the background (optimistic UI). Never show a "Connecting to Blockchain..." spinner.  
3. **Screen Shielding:** Implement expo-screen-capture prevention (on Android) or a blur view on iOS to prevent screenshots of sensitive health data.  
4. **Edge Formatting:** The mobile app does NOT format data into FHIR R4. It strictly saves and encrypts its raw JSON state. Do not bloat the mobile bundle with clinical terminology mappers.

## **4\. Immediate Execution Plan**

1. **Initialize Expo Project:** Set up the React Native environment with TypeScript and Expo Router.  
2. **Typography Setup:** Configure local fonts based on the specifications provided in Section 5 to maintain the established aesthetic.  
3. **Prototype the Astrolabe Dashboard:** Build the interactive, rotating chronograph component that calculates current cycle phases based on raw user configuration data.  
4. **Wire the Encryption Trigger:** Connect the "Inscribe" button to the local CryptoService to generate the base ciphertext payload before background syncing.

## **5\. Design Specifications**

*\[AI Agent Directive: This section is intentionally blank. You are tasked with defining the specific color hex codes, typography selections, spacing units, and component styling (borders, radii, shadows) that will fulfill the "Sovereign Journal" and "Digital Ledger" aesthetic described above.\]*

* **Color Palette:**  
  * Backgrounds (Paper/Parchment equivalents): \[To be defined\]  
  * Primary Text (Digital Ink equivalents): \[To be defined\]  
  * Accents/Highlights: \[To be defined\]  
* **Typography:**  
  * Primary Font (Serif): \[To be defined\]  
  * Secondary Font (Sans-Serif/UI): \[To be defined\]  
* **Component Styling:**  
  * Borders & Dividers: \[To be defined\]  
  * Corner Radii: \[To be defined\]  
  * Shadows & Elevation: \[To be defined\]