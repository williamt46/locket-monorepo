

### **1\. Project Context & User Psychology**

* **The User Need:** Users are retreating to pen-and-paper tracking because they fear their digital data is being surveilled, sold, or subpoenaed (Source: *Winslow*). They do not trust "Cloud" icons or "Sync" buttons.  
* **The Solution:** Locket is a digital application that behaves like a physical object. It lives *only* on the device.  
* **The Aesthetic:** "Digital Ink." The UI should feature cream/off-white backgrounds, high-quality serif typography, and interactions that mimic the permanence of writing.  
* **The Metaphor:**  
  * **Authentication** \= "Opening the Locket."  
  * **Encryption** \= "Closing the Clasp."  
  * **Data Entry** \= "Inscribing the Ledger."

---

### **2\. Epics: The "Sovereign Journal" Framework**

#### **Epic 1: The Ritual of Entry (Authentication)**

*Focus: Establishing the device as a secure, physical container.*

**User Story 1.1: Opening the Locket**

* **Context:** The user launches the app. The screen shows a closed, stylized locket or journal cover. The content is hidden.  
* **Action:** The user authenticates via Biometrics (FaceID/TouchID) or a local Passcode.  
* **UI Behavior:** Upon success, an animation plays of a clasp unlocking and a book opening to the current date. This visualizes the decryption of the local SQLite database.  
* **UCD Principle:** **Tangibility.** The user must *feel* that the data was physically locked away and is now accessible only to them.

**User Story 1.2: The Privacy Shield**

* **Context:** The user switches apps (multitasking) or locks their phone.  
* **Action:** The app immediately blurs the screen content or reverts to the "Closed Locket" state in the OS app switcher.  
* **Context:** This prevents "shoulder surfing" and reinforces that the app is a private space.

#### **Epic 2: Inscribing the Ledger (Data Input)**

*Focus: The "Digital Ink" aesthetic and the "Winslow" Grid method.*

**User Story 2.1: The Daily Inscription**

* **Context:** The user wants to log their cycle status (e.g., menstruation flow, symptoms).  
* **Action:** The user taps a date on a grid. The interaction should not feel like "filling a form" but rather "stamping" or "writing" on a page.  
* **UI Elements:** Use "Ink" interactions—when a symptom is selected, it should appear to be written or stamped onto the page, perhaps with a slight "wet ink" animation or sound effect.  
* **Constraint:** No "Submit" buttons. Data is saved (inscribed) instantly to the local encrypted store.

**User Story 2.2: The Infinite Page (Navigation)**

* **Context:** The user wants to see past cycles.  
* **Action:** Instead of infinite scrolling or standard calendars, the user "turns the page" (horizontal swipe with page-turn animation) to view previous months.  
* **Visuals:** The "Paper" texture should remain consistent. Past data should look "dried" or permanent (referencing the immutable audit log), while today's date looks active.

**User Story 2.3: Calendar view (physical journal-like horizontal navigation)**

Context: I want a monthly calendar view so I can quickly navigate to any day to input data.

Action: This is a more standardized calendar view but uses the same horizontal page-turn UI to view previous months. Data entry should be as easy as clicking on a day to input the period start date and feel intuitive to perform the actions.

Visuals: horizontal calendar navigation. "paper" texture. Past data should look permanent, while current week looks active.

**User story 2.4: Reproductive cycle visualization (within calendar view)**

Context: I want to see my current and past period length and next predicted period in the calendar view so I can quickly and easily visualize my period data.

Action: Add more context to the calendar view. Periods are like events on the calendar. The period length should be easy to see.

Visuals: Color-coded highlights on the calendar that show past, current, and predicted period.

**User story 2.5: Yearly view (vertical calendar navigation)**

Context: I want at-a-glance view of my past periods so I can visualize trends and see my average cycle length and period length in one place.

Action: A separate vertical calendar view. Each month has its own calendar card titled \<month year\>. Days with data entry are clearly marked with the same color-coding scheme in user story 2.4

Visuals: The UI design is similar to Instagram's stories archive calendar.

**User story 2.6: Current date blinker.**

Context: I want to quickly navigate to today's date so I can input today's data.

Action: \<input action\> Visuals: A blinking halo effect on today's date.

**User story 2.7: Data entry pop-up**

Context: When clicking on a day to enter data, I want the ability to add more information so I can make the entry as detailed as I want to.

Action: A pop-up window appears when the user wants to input data. On the header, it has the date \<MM-DD\>. There are two buttons below it. The left button is to set this date as the start date of my period, the right button is to set it as the end date. (refer to Simpluna). Below the buttons, there is a text input field (refer to Flo). Make this a free-text field for now.

**User story 2.8: Auto-fill**

Context: When I set any day as the "start date" or "end date" of my period in the pop-up, the app will auto-fill the days around that date, which saves me time and effort manually adding each day. If I need to adjust the dates of an existing cycle, the app should detect the conflict and update that specific period window, preventing "ghost" duplicates while still allowing for separate, distinct cycles within the same month if they are far apart.

Action: When the user sets any day as the "start date", it will auto-fill the next six days (correctly handling month/year crossovers), effectively creating a 7-day period window. Conversely, if user sets a day as the "end date", it will auto-fill the previous six days. If the new start or end date falls within or near (±3 days) an existing period window, that existing window will clear/reset before the new period window populates.

Visuals: Dates are filled in and visible in the calendar view and yearly view.

**User story 2.9: The nuke (app reset)**

Context: When I want to wipe all the data, especially if there’s corrupted data, I can press one button to delete all data entries and return to factory settings.

Action: When the user wants to wipe all data and return to the app’s initial state, they can unilaterally perform data erasure. Initial state means returning to factory settings for UI configurations, color scheme, app permissions, user profile information, and any other settings.

Visuals: The erase all data is a button at the bottom of the settings screen in red text. A pop up warning appears that informs what the user is about to do before the user can proceed.

#### **Epic 3: The Integrity Seal (Security Feedback)**

*Focus: Visualizing the Blockchain Anchor without using the word "Blockchain."*

**User Story 3.1: Closing the Clasp**

* **Context:** The user finishes logging data and closes the app.  
* **Action:** A subtle animation shows a "Seal" or "Lock" icon pulsing briefly.  
* **Meaning:** This represents the background process where the data hash is anchored to the Hyperledger Fabric ledger.  
* **UI Feedback:** If the hash matches (integrity verified), the seal is Gold/Green. If there is a sync error or integrity mismatch, the seal appears broken (Red).  
* **UCD Principle:** **Visibility of System Status.** The user knows their data is sealed without needing to understand SHA-256 hashing.

---

### **3\. Actions & Deliverables**

**Action 1: Design the "Aged Paper" System**

* **Color Palette (Dominant):**  
  - **Aged Vellum (\#FDFCF5):** Primary background texture.  
  - **Obsidian Ink (\#1A1C22):** Primary text and "Digital Ink" color.  
  - **Seal Gold (\#D4AF37):** Accent for integrity seals and shared states.  
  - **Alert Madder (\#B22222):** Low-saturation red for errors or broken seals.  
* **Typography:**  
  - **Display:** A premium Serif (e.g., *EB Garamond* or *Playfair Display*) for date headers and "Inscriptions."  
  - **UI/Nav:** A clean, high-legibility Sans-Serif (e.g., *Inter* or *SF Pro*).  
* **Deliverable:** A `theme.ts` file that enforces these specific tokens.

**Action 2: Build the "Locket" Authentication Component** 

* Implement `expo-local-authentication`.  
* Create the "Unlocking" Lottie animation.  
* **Deliverable:** A splash screen that transitions seamlessly into the main Ledger view upon biometric success.

**Action 3: Build the "Virtualized Grid" Interface**

* Create a custom Calendar component using **FlashList (Virtualized)** for the horizontal month-to-month page turns. This ensures 60FPS performance even with years of data.  
* Implement **Haptic Feedback** (using `expo-haptics`) for the following events:  
  - "Stamping" a day (Light impact).  
  - "Unlocking" the locket (Success vibration).  
  - Integrity Error (Warning pattern).  
* **Constraint:** All interactive cells in the Grid must have a minimum touch target of **44x44px**.  
* **Deliverable:** A high-performance horizontal swiping calendar with physical feedback.

---

#### **Epic 4: The Shared Ledger (Pro Tier)**

*Focus: Visualizing the "Portal" to medical providers and third-party services.*

**User Story 4.1: The Portal View (Portability)**

- **Context:** The user wants to grant access to a doctor.  
- **Action:**  
  1. User navigates to a "Portal" screen.  
  2. User selects a provider (via Search, ID, or QR scan).  
  3. User sets an "Expiration" (e.g., 24 hours, 7 days).  
  4. User taps "Unlock Portal."  
- **UI Behavior:** An animation of a "Bridge" forming or a "Window" opening to the provider. The "Clasp" on the locket glows gold.  
- **UCD Principle:** **Control.** The user must feel they are "opening a window" that they can close at any time.

**User Story 4.2: The Cloud Mirror (Encrypted Backup)**

- **Context:** User wants to enable cloud backup.  
- **Action:**  
  1. User toggles "Mirror to Cloud" in settings.  
  2. User authenticates with Google/iCloud.  
- **Visuals:** A subtle "Mirror" effect on the ledger page, showing that a reflection exists elsewhere.  
- **Feedback:** A "Mirrored" icon appears next to the Integrity Seal once the backup is confirmed.

**User Story 4.3: The Migration Service (Import)**

- **Context:** User has a CSV from Clue.  
- **Action:**  
  1. User selects "Import from Legacy Journal" (import).  
  2. UI displays a "Transcribing" animation as it converts the CSV into Locket's "Digital Ink" entries.  
- **Visuals:** Old data appearing to be written onto the ledger pages in real-time.

### **4\. Security Tiers & Privacy (Frontend)**

1. **Security Tiers:** The UI should distinguish between:  
   - **Core:** Local inscriptions and integrity seals.  
   - **Pro:** Consolidated Cloud Mirroring (Sync) and Portal (Sharing) services.  
2. **Zero-Analytics Policy:** Do not implement Firebase Analytics, Mixpanel, or Sentry. The app must not track user behavior or "phone home." (Source: *Privacy International* warnings on data leakage).  
3. **Screen Shielding:** Implement `expo-screen-capture` prevention (on Android) or a blur view on iOS to prevent screenshots of sensitive health data.  
4. **Local-Only Mode:** The UI must never show a "Connecting..." spinner for core features. The app must feel 100% responsive offline. The blockchain anchoring happens silently in the background (optimistic UI).

---

### **5\. Immediate Execution Plan**

1. **Initialize Expo Project:** Set up the React Native environment with TypeScript.  
2. **Asset Generation:** Generate the "Paper" background textures and "Locket" SVGs.  
3. **Navigation Setup:** Configure a simple Stack Navigator where the "Auth/Locket" screen is the gatekeeper to the "Ledger" screen.  
4. **Prototype the Grid:** Build the interactive calendar component using the "Digital Ink" visual style.

---

### **6\. Strategic Notes for the AI**

* **Tone:** The UI text should be minimal. Use words like "Journal," "Log," "Seal," and "Open." Avoid "Database," "Sync," "Cloud," or "Account."  
* **Trust Signals:** Trust is not built by explaining the tech stack (Source: *Ng et al.*). Trust is built by the interface behaving consistently like a physical object that the user *owns*. If it feels like a book, they will trust it like a book.  
* **The "Paper Retreat" Pivot:** We are not trying to be better than Clue or Flo at predictions. We are trying to be better than *Paper* at convenience, while keeping the privacy of Paper. Design for that user.  
* **Follow UCD principles**. "seal" "lock" "permanent digital ink" and other aesthetics should be consistent throughout with respect to the privacy and immutability theme.

