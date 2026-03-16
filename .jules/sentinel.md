## 2026-03-08 - [DoS Protection & Error Information Leakage]
**Vulnerability:**
- The `/api/` endpoints on the serverless gateway lacked rate limiting, exposing them to Denial of Service (DoS) attacks.
- The `catch` blocks in `apps/serverless-gateway/src/index.ts` returned `e.message` directly in 500/404 HTTP responses, potentially leaking sensitive network details (e.g., Fabric ledger or internal architecture info) to clients.
**Learning:**
- In microservices or serverless architectures (like Express interacting with gRPC Fabric SDK), raw internal errors shouldn't be exposed directly to public APIs since they can provide attackers with an understanding of the backend architecture.
- Although decentralized ledgers mitigate some failure points, the intermediary REST gateway remains a single point of ingestion and needs DoS protection (rate limiting) to avoid resource exhaustion.
**Prevention:**
- Always log full internal error traces (e.g., using `console.error`) for server observability but sanitize external client error messages to be generic (e.g., "An internal error occurred").
- Enforce API rate limiting (e.g., via `express-rate-limit`) on open public gateways to throttle unexpected traffic bursts.
