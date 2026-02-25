#!/bin/bash
set -euo pipefail

# =============================================================================
# gateway.test.sh — Integration tests for the Serverless Gateway.
#
# Prerequisites:
#   - Fabric test network running with ConInSe chaincode deployed
#   - Gateway server running on localhost:3000
#
# Usage:
#   cd apps/serverless-gateway && bash tests/gateway.test.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GW="http://localhost:3000"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✓ PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ✗ FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "=== Phase 5: Serverless Gateway Integration Tests ==="
echo ""

# ─────────────────────────────────────────────
# Step 0: Generate real PRE test material
# ─────────────────────────────────────────────
echo "[G5.0] Generating PRE test data..."
TEST_DATA=$(node "$SCRIPT_DIR/generate-test-data.js" 2>&1)
if [ $? -ne 0 ]; then
  echo "  Failed to generate test data: $TEST_DATA"
  exit 1
fi

# Extract fields from JSON
ALICE_PK=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.alice.publicKeyB64)})")
BOB_PK=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.bob.publicKeyB64)})")
CIPHERTEXT=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.ciphertextB64)})")
CAPSULE=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.capsuleB64)})")
ANCHOR=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.anchorHash)})")
KFRAG=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.kfragB64)})")
VERIFYING_KEY=$(echo "$TEST_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.verifyingKeyB64)})")

USER_DID="did:locket:gateway_test_$(date +%s)"
echo "  Test DID: $USER_DID"
echo "  PRE material generated ✓"
echo ""

# ─────────────────────────────────────────────
# G5.1: Health check
# ─────────────────────────────────────────────
echo "[G5.1] Testing health endpoint..."
HEALTH=$(curl -s "$GW/health" 2>&1 || echo "CURL_FAIL")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "Server is running and healthy"
else
  fail "Server not reachable at $GW"
  echo "  Output: $HEALTH"
  echo "  → Start the server: cd apps/serverless-gateway && npm run dev"
  exit 1
fi

# ─────────────────────────────────────────────
# G5.2: POST /api/data/upload
# ─────────────────────────────────────────────
echo "[G5.2] Testing POST /api/data/upload..."
UPLOAD_BODY=$(cat <<EOF
{
  "userDid": "$USER_DID",
  "ciphertextB64": "$CIPHERTEXT",
  "capsuleB64": "$CAPSULE",
  "anchorHash": "$ANCHOR"
}
EOF
)

UPLOAD_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$GW/api/data/upload" \
  -H "Content-Type: application/json" \
  -d "$UPLOAD_BODY")

HTTP_CODE=$(echo "$UPLOAD_RESULT" | tail -1)
BODY=$(echo "$UPLOAD_RESULT" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  pass "Data upload returned 201"
else
  fail "Expected 201, got $HTTP_CODE"
  echo "  Body: $BODY"
fi

# ─────────────────────────────────────────────
# G5.3: POST /api/consent/grant
# ─────────────────────────────────────────────
echo "[G5.3] Testing POST /api/consent/grant..."
GRANT_BODY=$(cat <<EOF
{
  "userDid": "$USER_DID",
  "recipientPublicKey": "$BOB_PK",
  "kFragBase64": "$KFRAG",
  "delegatorPublicKeyBase64": "$ALICE_PK",
  "anchorHash": "$ANCHOR",
  "durationMinutes": 60,
  "verifyingKeyBase64": "$VERIFYING_KEY"
}
EOF
)

GRANT_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$GW/api/consent/grant" \
  -H "Content-Type: application/json" \
  -d "$GRANT_BODY")

HTTP_CODE=$(echo "$GRANT_RESULT" | tail -1)
BODY=$(echo "$GRANT_RESULT" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  pass "Consent grant returned 201"
  if echo "$BODY" | grep -q "ConInSe Consent Token Generated"; then
    pass "Consent token confirmed on-chain"
  else
    fail "Unexpected response body"
    echo "  Body: $BODY"
  fi
else
  fail "Expected 201, got $HTTP_CODE"
  echo "  Body: $BODY"
fi

# Brief wait for on-chain state propagation
sleep 2

# ─────────────────────────────────────────────
# G5.4: GET /api/data/request (valid consent — real PRE round-trip)
# ─────────────────────────────────────────────
echo "[G5.4] Testing GET /api/data/request (valid consent)..."
ENCODED_PK=$(node -e "console.log(encodeURIComponent('$BOB_PK'))")
REQUEST_RESULT=$(curl -s -w "\n%{http_code}" \
  "$GW/api/data/request/$USER_DID/$ENCODED_PK")

HTTP_CODE=$(echo "$REQUEST_RESULT" | tail -1)
BODY=$(echo "$REQUEST_RESULT" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  pass "Data request returned 200"
  # Check that cfragB64 is present (PRE re-encryption happened)
  if echo "$BODY" | grep -q '"cfragB64"'; then
    pass "cfragB64 present in response (re-encryption succeeded)"
  else
    fail "cfragB64 missing from response"
    echo "  Body: $BODY"
  fi
  # Check verifyingKeyB64
  if echo "$BODY" | grep -q '"verifyingKeyB64"'; then
    pass "verifyingKeyB64 present in response"
  else
    fail "verifyingKeyB64 missing from response"
    echo "  Body: $BODY"
  fi
else
  fail "Expected 200, got $HTTP_CODE"
  echo "  Body: $BODY"
fi

# ─────────────────────────────────────────────
# G5.5: GET /api/data/request (unknown DID — expect 403)
# ─────────────────────────────────────────────
echo "[G5.5] Testing GET /api/data/request (unknown DID)..."
NOT_FOUND_RESULT=$(curl -s -w "\n%{http_code}" \
  "$GW/api/data/request/did:locket:nobody/$ENCODED_PK")

HTTP_CODE=$(echo "$NOT_FOUND_RESULT" | tail -1)

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
  pass "Unknown DID correctly rejected ($HTTP_CODE)"
else
  fail "Expected 403 or 404, got $HTTP_CODE"
  echo "  Body: $(echo "$NOT_FOUND_RESULT" | sed '$d')"
fi

# ─────────────────────────────────────────────
# G5.6: Validation — missing fields on upload
# ─────────────────────────────────────────────
echo "[G5.6] Testing POST /api/data/upload (missing fields)..."
BAD_UPLOAD=$(curl -s -w "\n%{http_code}" -X POST "$GW/api/data/upload" \
  -H "Content-Type: application/json" \
  -d '{"userDid":"test"}')

HTTP_CODE=$(echo "$BAD_UPLOAD" | tail -1)

if [ "$HTTP_CODE" = "400" ]; then
  pass "Missing fields correctly rejected (400)"
else
  fail "Expected 400 for missing fields, got $HTTP_CODE"
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "============================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

echo ""
echo "=== Phase 5: ALL CHECKPOINTS PASSED ==="
