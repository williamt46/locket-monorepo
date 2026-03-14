# Handoff P7: Minimal Provider Portal

## 📋 Status
**Completed**

## 🎯 Deliverables Scaffolded
1. **`@locket/portal-core`**: Shared package abstracting the `GET /api/data/request` proxy re-encryption endpoint and wrapping `@locket/crypto-engine`'s `decryptAsRecipient()` WASM call.
2. **`@locket/provider-portal`**: Minimal Vite + React app for Phase 7. Both `vite-plugin-wasm` and `vite-plugin-top-level-await` are configured natively.
3. **FHIR R4 Edge Formatting**: Integrated `@locket/fhir-formatter` directly into the provider portal's `App.tsx` immediately after PRE decryption to transform raw payload into an HL7 FHIR R4 Bundle directly in the frontend browser.

## ✅ Verification Results
1. **Unit Testing (`@locket/portal-core`)**
   - Command: `cd packages/portal-core && npx vitest run`
   - Result: `1 passed (1)` — successfully asserts the `GatewayResponse` is forwarded to `CryptoService.decryptAsRecipient()` with the correct type mappings.
2. **UI Smoke Test (`@locket/provider-portal`)**
   - Command: `npm run dev --workspace=@locket/provider-portal`
   - Result: `VITE v7.3.1 ready in 309 ms -> Local: http://localhost:3001/`

## 🔗 Architecture Context
- The provider portal fetches blinded re-encrypted capsule fragments (cFrags).
- Runs `decryptAsRecipient()` natively in the browser via WebAssembly (`vite-plugin-wasm`).
- Renders the resulting plain text as both raw JSON and a FHIR R4 Bundle.
