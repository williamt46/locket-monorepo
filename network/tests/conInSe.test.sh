#!/bin/bash
set -euo pipefail

# =============================================================================
# conInSe.test.sh — Integration tests for the ConInSe chaincode.
#
# Prerequisites:
#   - Fabric test network running with ConInSe chaincode deployed
#   - Run: cd network && bash deploy-conInSe.sh
#
# Usage:
#   cd network && bash tests/conInSe.test.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../fabric-samples/test-network"

# Set up Fabric environment for Org1
export PATH="$NETWORK_DIR/../bin:$PATH"
export FABRIC_CFG_PATH="$NETWORK_DIR/../config/"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

# Orderer TLS CA for invoke commands
ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✓ PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ✗ FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "=== Phase 4: ConInSe Smart Contract Integration Tests ==="
echo ""

# ─────────────────────────────────────────────
# C4.1: Network health check
# ─────────────────────────────────────────────
echo "[C4.1] Verifying Fabric network..."
PEER_COUNT=$(docker ps --filter "name=peer" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PEER_COUNT" -ge 2 ]; then
  pass "Fabric network running ($PEER_COUNT peers)"
else
  fail "Expected ≥2 peers, got $PEER_COUNT"
  echo "  → Run: cd network && bash deploy-conInSe.sh"
  exit 1
fi

# ─────────────────────────────────────────────
# C4.2: Chaincode committed
# ─────────────────────────────────────────────
echo "[C4.2] Verifying chaincode commitment..."
CC_QUERY=$(peer lifecycle chaincode querycommitted --channelID mychannel --name basic 2>&1 || true)
if echo "$CC_QUERY" | grep -q "basic"; then
  pass "Chaincode 'basic' committed on mychannel"
else
  fail "Chaincode 'basic' not found"
  echo "  Output: $CC_QUERY"
  exit 1
fi

# ─────────────────────────────────────────────
# C4.3: GrantConsentEvent
# ─────────────────────────────────────────────
echo "[C4.3] Testing GrantConsentEvent..."
# Set expiration far in the future (year 2099)
GRANT_RESULT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "$ORDERER_CA" \
  -C mychannel -n basic \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$CORE_PEER_TLS_ROOTCERT_FILE" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"ConInSeContract:GrantConsentEvent","Args":["did:locket:alice","pubkey_bob_test","kfrag_test_base64","delegator_pk_test","hash_abc123","4102444800000"]}' \
  2>&1)

if echo "$GRANT_RESULT" | grep -q "status:200"; then
  pass "GrantConsentEvent executed (status 200)"
else
  fail "GrantConsentEvent failed"
  echo "  Output: $GRANT_RESULT"
fi

# Brief wait for state to propagate
sleep 2

# ─────────────────────────────────────────────
# C4.4: VerifyConsentEvent (expect valid=true)
# ─────────────────────────────────────────────
echo "[C4.4] Testing VerifyConsentEvent (active consent)..."
VERIFY_RESULT=$(peer chaincode query \
  -C mychannel -n basic \
  -c '{"function":"ConInSeContract:VerifyConsentEvent","Args":["did:locket:alice","pubkey_bob_test"]}' \
  2>&1)

if echo "$VERIFY_RESULT" | grep -q '"valid":true'; then
  pass "VerifyConsentEvent returned valid=true"
  # Also check kFrag is returned
  if echo "$VERIFY_RESULT" | grep -q '"kFragBase64":"kfrag_test_base64"'; then
    pass "kFragBase64 correctly returned"
  else
    fail "kFragBase64 not found in response"
    echo "  Output: $VERIFY_RESULT"
  fi
else
  fail "Expected valid=true"
  echo "  Output: $VERIFY_RESULT"
fi

# ─────────────────────────────────────────────
# C4.5: RevokeConsentEvent
# ─────────────────────────────────────────────
echo "[C4.5] Testing RevokeConsentEvent..."
REVOKE_RESULT=$(peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "$ORDERER_CA" \
  -C mychannel -n basic \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$CORE_PEER_TLS_ROOTCERT_FILE" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"ConInSeContract:RevokeConsentEvent","Args":["did:locket:alice","pubkey_bob_test"]}' \
  2>&1)

if echo "$REVOKE_RESULT" | grep -q "status:200"; then
  pass "RevokeConsentEvent executed (status 200)"
else
  fail "RevokeConsentEvent failed"
  echo "  Output: $REVOKE_RESULT"
fi

# Brief wait for state to propagate
sleep 2

# ─────────────────────────────────────────────
# C4.6: VerifyConsentEvent after revocation (expect valid=false)
# ─────────────────────────────────────────────
echo "[C4.6] Testing VerifyConsentEvent (post-revocation)..."
VERIFY_REVOKED=$(peer chaincode query \
  -C mychannel -n basic \
  -c '{"function":"ConInSeContract:VerifyConsentEvent","Args":["did:locket:alice","pubkey_bob_test"]}' \
  2>&1)

if echo "$VERIFY_REVOKED" | grep -q '"valid":false'; then
  pass "Post-revocation returns valid=false"
  if echo "$VERIFY_REVOKED" | grep -q '"reason":"Consent revoked"'; then
    pass "Revocation reason correctly reported"
  else
    fail "Expected reason 'Consent revoked'"
    echo "  Output: $VERIFY_REVOKED"
  fi
else
  fail "Expected valid=false after revocation"
  echo "  Output: $VERIFY_REVOKED"
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
echo "=== Phase 4: ALL CHECKPOINTS PASSED ==="
