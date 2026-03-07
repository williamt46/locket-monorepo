#!/bin/bash
set -euo pipefail

# =============================================================================
# deploy-conInSe.sh — Deploy the updated chaincode package (now includes
# both IntegrityContract and ConInSeContract) to the Fabric test network.
#
# Usage:
#   cd network && bash deploy-conInSe.sh
#
# Prerequisites:
#   - Docker Desktop running
#   - Fabric binaries on PATH (../bin from test-network)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/fabric-samples/test-network"
CHAINCODE_DIR="$SCRIPT_DIR/chaincode"

echo "=== ConInSe Chaincode Deployment ==="

# 1. Check Docker
if ! docker info > /dev/null 2>&1; then
  echo "FAIL: Docker is not running"
  exit 1
fi
echo "[1/4] Docker is running ✓"

# 2. Always start fresh to ensure crypto material + chaincode are in sync
echo "[2/4] Starting Fabric test network (clean restart)..."
cd "$NETWORK_DIR"
./network.sh down 2>/dev/null || true
./network.sh up createChannel -c mychannel -ca -s couchdb
cd "$SCRIPT_DIR"
echo "[2/4] Fabric network started ✓"

# 3. Clean up stale CCAAS containers and deploy
echo "[3/4] Deploying chaincode via CCAAS..."
docker rm -f peer0org1_basic_ccaas peer0org2_basic_ccaas 2>/dev/null || true
cd "$NETWORK_DIR"

# Deploy chaincode-as-a-service — the same package now includes ConInSeContract
./network.sh deployCCAAS -ccn basic -ccp "$CHAINCODE_DIR" -ccaasdocker true

cd "$SCRIPT_DIR"
echo "[3/4] Chaincode deployed ✓"

# 4. Verify deployment
echo "[4/4] Verifying deployment..."
# The peer's own identity already has permission to query local state
docker exec peer0.org1.example.com peer lifecycle chaincode querycommitted \
  --channelID mychannel --name basic 2>&1 | grep -A 1 "Committed chaincode definition"
echo ""
echo "=== ConInSe Deployment Complete ==="
echo ""
echo "  IntegrityContract: CreateAsset, ReadAsset, AssetExists, CreateAssetBatch"
echo "  ConInSeContract:   GrantConsentEvent, VerifyConsentEvent, RevokeConsentEvent"
