#!/bin/bash
set -e

# Navigate to test-network
cd fabric-samples/test-network

# 1. Bring down any previous network
./network.sh down

# 2. Start the network with Certificate Authority and CouchDB
# -ca: Use CAs (needed for user enrollment)
# -s: CouchDB (better for queries)
./network.sh up createChannel -c mychannel -ca -s couchdb

# 3. Deploy Chaincode (Chaincode-as-a-Service to avoid Docker-in-Docker issues)
# -ccn: Chaincode Name
# -ccp: Chaincode Path
# -ccaasdocker: Build/Run docker container on host
./network.sh deployCCAAS -ccn basic -ccp ../../chaincode -ccaasdocker true

echo "Network started and Chaincode deployed!"
