#!/usr/bin/env bash
# Phase 9.1 Checkpoint Tests — Encrypted Backup
set -euo pipefail
echo "=== Phase 9.1: Platform-Agnostic Encrypted Backup ==="

cd "$(dirname "$0")/.."

# C9.1.1: Verify required expo dependencies
echo "[C9.1.1] Checking UX dependencies..."
for pkg in expo-sharing expo-file-system expo-document-picker; do
  if ! grep -q "\"$pkg\"" package.json; then
    echo "FAIL: $pkg is missing from package.json"
    exit 1
  fi
done
echo "PASS: All Expo dependencies installed"

# C9.1.2: Run Crypto Unit Tests
echo "[C9.1.2] Running Backup Service crypto tests..."
npx vitest run __tests__/CloudBackupService.test.ts

echo "=== Phase 9.1: ALL CHECKPOINTS PASSED ==="
