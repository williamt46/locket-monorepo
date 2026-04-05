#!/usr/bin/env bash
# setup-dev-env.sh — One-shot dev environment setup for locket-monorepo.
#
# Clones hyperledger/fabric-samples at the pinned commit, installs Fabric
# binaries, starts the test-network, and deploys the basic chaincode so the
# serverless-gateway can connect.
#
# Safe to re-run: each step is idempotent.
#
# Usage:
#   cd <worktree-root>/network
#   ./setup-dev-env.sh
#
# Options:
#   --skip-network    Clone + binaries only; don't start Docker network
#   --skip-chaincode  Start network but skip chaincode deploy
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_SAMPLES="${SCRIPT_DIR}/fabric-samples"

# Pinned to the commit present in the source worktree
FABRIC_SAMPLES_COMMIT="da2240f"
FABRIC_SAMPLES_REPO="https://github.com/hyperledger/fabric-samples.git"
FABRIC_VERSION="2.5.14"
FABRIC_CA_VERSION="1.5.15"

RED='\033[0;31m'
YLW='\033[0;33m'
GRN='\033[0;32m'
BLD='\033[1m'
RST='\033[0m'

log()  { echo -e "${GRN}[setup]${RST} $*"; }
warn() { echo -e "${YLW}[setup] WARN:${RST} $*" >&2; }
fail() { echo -e "${RED}${BLD}[setup] FAIL:${RST} $*" >&2; exit 1; }
step() { echo; echo -e "${BLD}━━ $* ${RST}"; }

SKIP_NETWORK=false
SKIP_CHAINCODE=false
for arg in "$@"; do
    case "${arg}" in
        --skip-network)   SKIP_NETWORK=true ;;
        --skip-chaincode) SKIP_CHAINCODE=true ;;
        --help|-h)
            echo "Usage: $0 [--skip-network] [--skip-chaincode]"
            exit 0 ;;
        *) fail "Unknown option: ${arg}" ;;
    esac
done

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
step "Checking prerequisites"

command -v git  &>/dev/null || fail "git is required but not installed."
command -v curl &>/dev/null || fail "curl is required but not installed."

if [[ "${SKIP_NETWORK}" == false ]]; then
    command -v docker &>/dev/null || fail "docker is required. Install Docker Desktop and ensure it is running."
    docker info &>/dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."
    log "Docker running"
fi

log "Prerequisites OK"

# ── 1. Clone fabric-samples ───────────────────────────────────────────────────
step "fabric-samples"

if [[ -d "${FABRIC_SAMPLES}/.git" ]]; then
    log "fabric-samples already cloned — verifying commit"
    CURRENT=$(git -C "${FABRIC_SAMPLES}" rev-parse --short HEAD)
    if [[ "${CURRENT}" != "${FABRIC_SAMPLES_COMMIT}"* ]]; then
        warn "fabric-samples is at ${CURRENT}, expected ${FABRIC_SAMPLES_COMMIT}."
        warn "Checking out pinned commit..."
        git -C "${FABRIC_SAMPLES}" fetch --quiet origin
        git -C "${FABRIC_SAMPLES}" checkout --quiet "${FABRIC_SAMPLES_COMMIT}"
    fi
    log "fabric-samples at $(git -C "${FABRIC_SAMPLES}" rev-parse --short HEAD)"
elif [[ -d "${FABRIC_SAMPLES}" ]] && [[ -n "$(ls -A "${FABRIC_SAMPLES}" 2>/dev/null)" ]]; then
    # Directory exists but not a git repo (gitlink placeholder from worktree)
    warn "fabric-samples directory exists but is not a git repo — re-initialising"
    rm -rf "${FABRIC_SAMPLES}"
    git clone --quiet "${FABRIC_SAMPLES_REPO}" "${FABRIC_SAMPLES}"
    git -C "${FABRIC_SAMPLES}" checkout --quiet "${FABRIC_SAMPLES_COMMIT}"
    log "fabric-samples cloned at ${FABRIC_SAMPLES_COMMIT}"
else
    log "Cloning hyperledger/fabric-samples..."
    git clone --quiet "${FABRIC_SAMPLES_REPO}" "${FABRIC_SAMPLES}"
    git -C "${FABRIC_SAMPLES}" checkout --quiet "${FABRIC_SAMPLES_COMMIT}"
    log "fabric-samples cloned at ${FABRIC_SAMPLES_COMMIT}"
fi

# ── 2. Fabric binaries ────────────────────────────────────────────────────────
step "Fabric binaries"

BINS_PATH="${FABRIC_SAMPLES}/bin"
PEER_BIN="${BINS_PATH}/peer"

if [[ -x "${PEER_BIN}" ]]; then
    log "Fabric binaries already present ($(${PEER_BIN} version 2>/dev/null | head -1 || echo 'peer found'))"
else
    log "Downloading Fabric ${FABRIC_VERSION} binaries..."
    bash "${SCRIPT_DIR}/install-fabric.sh" -f "${FABRIC_VERSION}" -c "${FABRIC_CA_VERSION}" binary
    [[ -x "${PEER_BIN}" ]] || fail "Binary install failed — peer not found at '${PEER_BIN}'"
    log "Fabric binaries installed"
fi

export PATH="${BINS_PATH}:${PATH}"

# ── 3. Start test-network ─────────────────────────────────────────────────────
if [[ "${SKIP_NETWORK}" == true ]]; then
    log "--skip-network set: skipping network start"
else
    step "test-network"

    TLS_CERT="${FABRIC_SAMPLES}/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"

    if [[ -f "${TLS_CERT}" ]]; then
        log "Crypto material already present — skipping network.sh up"
        log "(Run 'cd ${FABRIC_SAMPLES}/test-network && ./network.sh down' first to force re-creation)"
    else
        log "Starting test-network with CA + CouchDB..."
        cd "${FABRIC_SAMPLES}/test-network"
        # Bring down any remnant containers from a previous run
        ./network.sh down 2>/dev/null || true
        ./network.sh up createChannel -c mychannel -ca -s couchdb
        cd "${SCRIPT_DIR}"
        log "test-network up, channel 'mychannel' created"
    fi

    # ── 4. Deploy chaincode ───────────────────────────────────────────────────
    if [[ "${SKIP_CHAINCODE}" == true ]]; then
        log "--skip-chaincode set: skipping chaincode deploy"
    else
        step "Chaincode deploy"

        CHAINCODE_PATH="${SCRIPT_DIR}/chaincode"
        [[ -d "${CHAINCODE_PATH}" ]] || fail "Chaincode directory not found at '${CHAINCODE_PATH}'"

        # Check if chaincode already committed on the channel
        export FABRIC_CFG_PATH="${FABRIC_SAMPLES}/config"
        export CORE_PEER_TLS_ENABLED=true
        export CORE_PEER_LOCALMSPID="Org1MSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="${TLS_CERT}"
        export CORE_PEER_MSPCONFIGPATH="${FABRIC_SAMPLES}/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
        export CORE_PEER_ADDRESS="localhost:7051"

        if peer lifecycle chaincode querycommitted \
                --channelID mychannel --name basic \
                --output json 2>/dev/null | grep -q '"name":"basic"'; then
            log "Chaincode 'basic' already committed on mychannel"
        else
            log "Deploying chaincode (CaaS mode)..."
            cd "${FABRIC_SAMPLES}/test-network"
            ./network.sh deployCCAAS -ccn basic -ccp "${CHAINCODE_PATH}" -ccaasdocker true
            cd "${SCRIPT_DIR}"
            log "Chaincode 'basic' deployed"
        fi
    fi
fi

# ── 5. Final validation ───────────────────────────────────────────────────────
step "Validation"
bash "${SCRIPT_DIR}/validate-fabric-env.sh"

echo
echo -e "${GRN}${BLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
echo -e "${GRN}${BLD}  Dev environment ready. Start the gateway:${RST}"
echo -e "    cd $(dirname "${SCRIPT_DIR}")"
echo -e "    npm run dev -w @locket/serverless-gateway"
echo -e "${GRN}${BLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
