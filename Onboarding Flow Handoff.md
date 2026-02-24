# **Locket MVP: Onboarding Flow ("Establish Ledger") Context**

## **Overview**

This document defines the exact UI flow, state boundaries, and data structures for the Locket Onboarding sequence. The UI is designed as a 4-step wizard that collects the user's physiological baseline (config) without relying on standard web forms or progress bars.

When building the local persistence layer, the agent must ensure that the final step of this flow successfully commits the config object to the local device storage (e.g., SQLite or SecureStore) before transitioning the user to the main Dashboard.

## **1\. The Target State Object (config)**

The onboarding flow strictly manipulates a single config object.

### **State Shape (TypeScript Interface)**

interface UserConfig {  
  /\*\* \* Strict ISO Date String (YYYY-MM-DD) representing the first day of the last period.  
   \* CRITICAL: Must be stored and parsed as UTC midnight to prevent timezone drift.  
   \*/  
  lastPeriodDate: string;   
    
  /\*\* \* Typical duration of menstruation in days.  
   \* Data Constraint: Minimum 2, Maximum 14\.   
   \*/  
  bleedLength: number;    

  /\*\* \* Typical duration of the entire cycle in days.  
   \* Data Constraint: Minimum 20, Maximum 45\.   
   \*/  
  cycleLength: number;      
}

### **Default Initialization State**

*Note to Agent: Do not use standard new Date().toISOString() for the default date, as local timezones can cause it to shift to the previous day. Initialize it strictly to the current local day formatted as UTC.*

{  
  "lastPeriodDate": "2026-02-22", // Must resolve to user's actual current local date  
  "bleedLength": 5,  
  "cycleLength": 28  
}

## **2\. UI Flow & Navigation Boundaries**

The OnboardingFlow component uses a local step integer (0 to 3\) to navigate the views. It does not use a router; it relies on conditional rendering and CSS transitions.

* **Step 0 (Welcome):** Text introduction. No state manipulation.  
* **Step 1 (Last Period):** Modifies config.lastPeriodDate via a native \<input type="date"\>.  
* **Step 2 (Bleed Length):** Modifies config.bleedLength. The UI uses Chevron buttons to increment/decrement. The UI logic strictly clamps the value between 2 and 14\.  
* **Step 3 (Cycle Length):** Modifies config.cycleLength. The UI uses Chevron buttons to increment/decrement. The UI logic strictly clamps the value between 20 and 45\.

## **3\. Execution Requirement (The "Seal Ledger" Event)**

On **Step 3**, the "Continue" button is replaced by the "Seal Ledger" button.

Currently, tapping "Seal Ledger" triggers the onComplete callback, which instantly transitions the React state to the dashboard view.

**Implementation Directive for the Agent:**

When wiring this UI to the persistence layer, the onComplete function must be intercepted.

1. The config object must be written to the local database.  
2. The UI must await a successful write operation.  
3. Only upon a successful local write should the app transition the appState to 'dashboard'.  
4. **Constraint:** Do not add a loading spinner during this database write. The local SQLite/SecureStore write should be virtually instantaneous (\< 50ms), preserving the "physical object" illusion of the app.