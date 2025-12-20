
## Deployment Script 

```bash
#!/bin/bash
# Bit-Earth PoE System Deployment Script

set -e

echo "========================================="
echo "Bit-Earth PoE System Deployment"
echo "========================================="

# Load environment
source .env

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "Error: $1 is not installed"
        exit 1
    fi
}

check_command cargo
check_command node
check_command docker
check_command charms

# Build everything
echo "Building contracts..."
make build-contracts

echo "Building circuits..."
make build-circuits

echo "Building web interface..."
make build-web

# Deploy to testnet
echo "Deploying to BitcoinOS Testnet..."

# Deploy PoE Minter
echo "Deploying PoE Minter Contract..."
POE_ADDRESS=$(charms deploy \
    --wasm spells/poe_zkbtc_minter.wasm \
    --network testnet \
    --name "PoEzkBTCMinter" \
    --args "$ADMIN_WALLET" "$TREASURY_WALLET" \
    --output-json | jq -r '.contract_address')

# Deploy Grail Vault
echo "Deploying Grail Vault Contract..."
VAULT_ADDRESS=$(charms deploy \
    --wasm spells/grail_vault.wasm \
    --network testnet \
    --name "GrailVault" \
    --args "$ADMIN_WALLET" \
    --output-json | jq -r '.contract_address')

# Deploy UTXO Verifier
echo "Deploying UTXO Verifier..."
UTXO_ADDRESS=$(charms deploy \
    --wasm spells/utxo_verifier.wasm \
    --network testnet \
    --name "UTXOVerifier" \
    --output-json | jq -r '.contract_address')

# Register spells
echo "Registering Charms Spells..."

charms spell register spells/mint-poe-zkbtc.yaml \
    --network testnet \
    --contract-addresses "{\"poe-zkbtc-minter.wasm\":\"$POE_ADDRESS\",\"grail-vault.wasm\":\"$VAULT_ADDRESS\"}"

charms spell register spells/burn-zkbtc-e.yaml \
    --network testnet \
    --contract-addresses "{\"poe-zkbtc-minter.wasm\":\"$POE_ADDRESS\",\"grail-vault.wasm\":\"$VAULT_ADDRESS\"}"

# Initialize oracle
echo "Initializing Oracle Service..."
docker build -t bit-earth-oracle oracle-service/

docker run -d \
    --name bit-earth-oracle \
    -e PRIVATE_KEY="$ORACLE_PRIVATE_KEY" \
    -e RPC_URL="$BITCOINOS_RPC" \
    -e POE_CONTRACT="$POE_ADDRESS" \
    -e VAULT_CONTRACT="$VAULT_ADDRESS" \
    --restart unless-stopped \
    bit-earth-oracle

# Update frontend config
echo "Updating frontend configuration..."
cat > web-app/.env.production << EOF
REACT_APP_POE_CONTRACT_ADDRESS=$POE_ADDRESS
REACT_APP_VAULT_CONTRACT_ADDRESS=$VAULT_ADDRESS
REACT_APP_UTXO_VERIFIER_ADDRESS=$UTXO_ADDRESS
REACT_APP_CHARMS_API_KEY=$CHARMS_API_KEY
REACT_APP_NETWORK=testnet
REACT_APP_ORACLE_ENDPOINT=http://localhost:8080
EOF

# Create deployment report
cat > deployment.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "network": "bitcoinos-testnet",
  "contracts": {
    "poe_zkbtc_minter": "$POE_ADDRESS",
    "grail_vault": "$VAULT_ADDRESS",
    "utxo_verifier": "$UTXO_ADDRESS"
  },
  "spells": {
    "mint-poe-zkbtc-e": "registered",
    "burn-zkbtc-e": "registered"
  },
  "services": {
    "oracle": "running",
    "web_app": "ready"
  }
}
EOF

echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Contract Addresses:"
echo "- PoE Minter:    $POE_ADDRESS"
echo "- Grail Vault:   $VAULT_ADDRESS"
echo "- UTXO Verifier: $UTXO_ADDRESS"
echo ""
echo "Next Steps:"
echo "1. Start web app: cd web-app && npm start"
echo "2. Monitor oracle: docker logs -f bit-earth-oracle"
echo "3. Test minting: Visit http://localhost:3000"
echo ""
echo "Full deployment details saved to deployment.json"
