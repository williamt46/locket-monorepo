# **Locket MVP: Payload Bifurcation & Edge-Formatting Architecture**

**AI Agent Directive:** This document is complementary to the locket\_backend\_master\_handoff.md. It defines how decrypted data is handled differently based on the requesting audience (Providers vs. Partners). You must enforce strict terminology: individuals utilizing the mobile app are "Users" or "Data Owners"—never "patients," as this is a sovereign tool, not a hospital-issued tracker.

## **1\. The Core Philosophy: Edge-Formatting**

To optimize mobile performance and maintain the pure Zero-Knowledge architecture, the mobile app (apps/app-universal) **does not** generate FHIR R4 bundles.

1. **The Source of Truth:** The mobile app encrypts its raw, proprietary state (UserConfig and LocketLedger) using NuCypher Umbral.  
2. **The Blind Proxy:** The serverless-gateway routes and re-encrypts this raw capsule blindly.  
3. **The Bifurcation:** Data formatting is executed locally within the browser of the requesting portal *after* decryption.  
   * **Clinical Flow:** The Provider Portal decrypts the raw state and runs it through @locket/fhir-formatter to generate a LOINC/SNOMED-compliant FHIR R4 Bundle.  
   * **Relational Flow:** The Partner Portal decrypts the raw state and bypasses the FHIR formatter entirely, feeding the raw JSON directly into a human-readable, non-clinical UI.

## **2\. Payload Distinction Definitions**

When a third party successfully decrypts the cFrag using their private key, they receive the **Base Payload**. How it is utilized depends entirely on the portal application.

### **The Base Payload (Received by BOTH Portals post-decryption)**

// Shared raw state from the Sovereign Journal mobile app  
{  
  "config": {  
    "lastPeriodDate": "2026-02-01",  
    "bleedLength": 5,  
    "cycleLength": 28  
  },  
  "ledger": {  
    "2026-02-23": { "flow": "heavy", "symptoms": \["cramps", "fatigue"\] }  
  }  
}

### **The Provider Portal Payload (Clinical / FHIR R4)**

The Provider Portal passes the Base Payload through the FhirService. The resulting data is highly structured, sterile, and intended for ingestion into EHR systems like Epic or Cerner.

* **Vocabulary:** LOINC (92656-8 for Menstrual Flow) and SNOMED CT (268953000 for Dysmenorrhea).  
* **Format:** Strict FHIR Bundle containing Observation and anonymous Patient resources linked via UUIDs.  
* **User Identity:** Represented solely as a Decentralized Identifier (DID) URI.

### **The Partner Portal Payload (Non-Clinical / Relational)**

The Partner Portal ignores the FhirService. It uses the Base Payload to calculate physical phases and temperaments to foster empathy and communication.

* **Vocabulary:** Human-centric terms (e.g., "Menstruation", "Ovulation", "Fertile Window").  
* **Format:** Raw JSON mapped directly to UI components (similar to the Astrolabe/Chronograph built in the mobile app).  
* **Focus:** Actionable relational insights (e.g., "Energy is naturally lower; prioritize recovery" based on the user's current cycle day).

## **3\. Partner Portal Implementation (apps/partner-portal)**

To complete the frontend edge of the PRE workflow, the agent must build the Partner Portal. Unlike the Provider View (which renders a sterile JSON tree), the Partner View calculates the user's current cycle phase from the raw payload.

### **3.1 Partner View Component (apps/partner-portal/src/components/PartnerView.tsx)**

'use client';  
import React, { useState, useEffect, useMemo } from 'react';  
import { CryptoService } from '@locket/crypto-engine';

interface PartnerViewProps {  
  userDid: string;  
  partnerKeys: { privateKeyBase64: string; publicKeyBase64: string };  
}

export default function PartnerView({ userDid, partnerKeys }: PartnerViewProps) {  
  const \[rawPayload, setRawPayload\] \= useState\<any\>(null);  
  const \[error, setError\] \= useState\<string | null\>(null);

  useEffect(() \=\> {  
    const fetchAndDecrypt \= async () \=\> {  
      try {  
        const encodedPubKey \= encodeURIComponent(partnerKeys.publicKeyBase64);  
        const res \= await fetch(\`http://localhost:3000/api/data/request/${userDid}/${encodedPubKey}\`);  
        if (\!res.ok) throw new Error("Connection failed or ConInSe Consent has been revoked.");

        const { ciphertextBase64, capsuleBase64, cFragBase64, delegatorPublicKeyBase64 } \= await res.json();  
          
        // Local Memory Decryption (Step 6 of PRE Workflow)  
        // NOTICE: We do NOT pass this to FhirService.  
        const decryptedJson \= CryptoService.decryptAsRecipient(  
          partnerKeys.privateKeyBase64,   
          delegatorPublicKeyBase64,   
          ciphertextBase64,   
          capsuleBase64,   
          cFragBase64  
        );  
          
        setRawPayload(decryptedJson);

      } catch (err: any) { setError(err.message); }  
    };  
    fetchAndDecrypt();  
  }, \[userDid, partnerKeys\]);

  // Derived State: Calculate the User's current phase based on the decrypted config  
  const currentState \= useMemo(() \=\> {  
    if (\!rawPayload || \!rawPayload.config) return null;  
      
    const { lastPeriodDate, bleedLength, cycleLength } \= rawPayload.config;  
      
    // Strict UTC calculation to prevent timezone drift  
    const \[year, month, day\] \= lastPeriodDate.split('-').map(Number);  
    const lastPeriodUTC \= new Date(Date.UTC(year, month \- 1, day));  
    const todayUTC \= new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));  
      
    const diffTime \= todayUTC.getTime() \- lastPeriodUTC.getTime();  
    const diffDays \= Math.floor(diffTime / (1000 \* 60 \* 60 \* 24));  
    const currentDay \= ((diffDays % cycleLength) \+ cycleLength) % cycleLength \+ 1;  
      
    const ovulationDay \= cycleLength \- 14;  
      
    if (currentDay \<= bleedLength) return { phase: 'Menstruation', guidance: 'Rest & Reflection. Energy is naturally lower.' };  
    if (currentDay \< ovulationDay \- 1\) return { phase: 'Follicular', guidance: 'Clarity & Planning. Energy is building.' };  
    if (currentDay \>= ovulationDay \- 1 && currentDay \<= ovulationDay \+ 1\) return { phase: 'Ovulation', guidance: 'Peak Expression. High energy and fertile window.' };  
    return { phase: 'Luteal', guidance: 'Intuition & Nesting. Winding down.' };  
      
  }, \[rawPayload\]);

  if (error) return \<div className="p-6 bg-red-50 text-red-700 rounded-lg"\>Access Denied: {error}\</div\>;  
  if (\!rawPayload) return \<div className="p-6 text-gray-500"\>Securely connecting to Proxy & Decrypting...\</div\>;

  return (  
    \<div className="max-w-md mx-auto p-8 bg-\[\#F9F8F4\] border border-\[\#E5E2D9\] shadow-xl rounded-2xl font-serif"\>  
      \<h2 className="text-2xl font-semibold text-\[\#2A2A2A\] mb-8 border-b border-\[\#E5E2D9\] pb-4"\>  
        Partner Ledger View  
      \</h2\>  
        
      \<div className="mb-8"\>  
        \<p className="text-xs tracking-widest uppercase text-\[\#A3A099\] mb-2 font-sans"\>Current Phase\</p\>  
        \<div className="bg-white p-6 rounded-lg border border-\[\#E5E2D9\]"\>  
          \<h3 className="text-xl font-semibold text-\[\#2A2A2A\] mb-2"\>{currentState?.phase}\</h3\>  
          \<p className="text-sm text-\[\#6B6861\] leading-relaxed"\>{currentState?.guidance}\</p\>  
        \</div\>  
      \</div\>

      \<div\>  
        \<p className="text-xs tracking-widest uppercase text-\[\#A3A099\] mb-4 font-sans"\>Recent Inscriptions\</p\>  
        \<div className="space-y-4"\>  
           {/\* Agent Note: Map through rawPayload.ledger here to show recent non-clinical symptoms \*/}  
           {Object.entries(rawPayload.ledger).slice(-3).map((\[date, log\]: \[string, any\]) \=\> (  
             \<div key={date} className="flex justify-between items-center py-3 border-b border-\[\#E5E2D9\] last:border-0"\>  
               \<span className="text-\[\#2A2A2A\]"\>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}\</span\>  
               \<div className="flex gap-2"\>  
                 {log.flow && \<span className="text-xs px-2 py-1 bg-\[\#8B1E0B\] text-white rounded opacity-80"\>{log.flow}\</span\>}  
                 {log.symptoms?.map((s: string) \=\> (  
                   \<span key={s} className="text-xs px-2 py-1 border border-\[\#A3A099\] text-\[\#6B6861\] rounded capitalize"\>{s}\</span\>  
                 ))}  
               \</div\>  
             \</div\>  
           ))}  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **Agent Validation Checklist**

1. Ensure @locket/fhir-formatter is **only** imported and utilized inside apps/provider-portal.  
2. Ensure the Partner Portal strictly utilizes the non-clinical UI calculations provided above.  
3. Validate that CryptoService.decryptAsRecipient yields the exact same raw payload in both portals before the edge-formatting branches diverge.