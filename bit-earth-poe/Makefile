# Bit-Earth Labs PoE System Makefile
# Author: Bit-Earth Team
# Date: $(shell date +%Y-%m-%d)

.PHONY: all build test deploy clean help

# Variables
CARGO := cargo
NPM := npm
DOCKER := docker
DOCKER_COMPOSE := docker-compose
CHARMS := charms

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
all: build

## Initialize project
init:
	@echo "${GREEN}Initializing Bit-Earth PoE project...${NC}"
	rustup target add wasm32-unknown-unknown
	${CARGO} install --locked charms-cli
	${NPM} install -g @charms/sdk @bitcoinos/wallet
	cd web-app && ${NPM} install
	@echo "${GREEN}✓ Project initialized${NC}"

## Build all components
build: build-contracts build-circuits build-web

## Build WASM contracts
build-contracts:
	@echo "${YELLOW}Building WASM contracts...${NC}"
	cd contracts/poe-zkbtc-minter && ${CARGO} build --target wasm32-unknown-unknown --release
	cd contracts/grail-vault && ${CARGO} build --target wasm32-unknown-unknown --release
	cd contracts/utxo-verifier && ${CARGO} build --target wasm32-unknown-unknown --release
	@mkdir -p spells
	cp contracts/poe-zkbtc-minter/target/wasm32-unknown-unknown/release/*.wasm spells/
	cp contracts/grail-vault/target/wasm32-unknown-unknown/release/*.wasm spells/
	cp contracts/utxo-verifier/target/wasm32-unknown-unknown/release/*.wasm spells/
	@echo "${GREEN}✓ Contracts built${NC}"

## Build zk-SNARK circuits
build-circuits:
	@echo "${YELLOW}Building zk-SNARK circuits...${NC}"
	cd circuits/poe-circuit && ${CARGO} build --release
	cd circuits/burn-circuit && ${CARGO} build --release
	@echo "${GREEN}✓ Circuits built${NC}"

## Build web application
build-web:
	@echo "${YELLOW}Building web interface...${NC}"
	cd web-app && ${NPM} run build
	@echo "${GREEN}✓ Web app built${NC}"

## Run tests
test: test-contracts test-circuits test-web

test-contracts:
	@echo "${YELLOW}Testing contracts...${NC}"
	cd contracts/poe-zkbtc-minter && ${CARGO} test -- --nocapture
	cd contracts/grail-vault && ${CARGO} test -- --nocapture
	cd contracts/utxo-verifier && ${CARGO} test -- --nocapture

test-circuits:
	@echo "${YELLOW}Testing zk-SNARK circuits...${NC}"
	cd circuits/poe-circuit && ${CARGO} test -- --nocapture
	cd circuits/burn-circuit && ${CARGO} test -- --nocapture

test-web:
	@echo "${YELLOW}Testing web application...${NC}"
	cd web-app && ${NPM} test

## Deploy to testnet
deploy: check-env deploy-contracts register-spells start-oracle

check-env:
	@if [ -z "$$BITCOINOS_RPC" ]; then \
		echo "${RED}Error: BITCOINOS_RPC not set${NC}"; \
		exit 1; \
	fi
	@if [ -z "$$CHARMS_API_KEY" ]; then \
		echo "${RED}Error: CHARMS_API_KEY not set${NC}"; \
		exit 1; \
	fi

deploy-contracts:
	@echo "${YELLOW}Deploying contracts to BitcoinOS Testnet...${NC}"
	@if [ ! -f spells/poe_zkbtc_minter.wasm ]; then \
		echo "${RED}Contracts not built. Run 'make build-contracts' first${NC}"; \
		exit 1; \
	fi
	
	@echo "${GREEN}Deploying PoE zkBTC-E Minter...${NC}"
	@${CHARMS} deploy spells/poe_zkbtc_minter.wasm \
		--network testnet \
		--name "PoEzkBTCMinter" \
		--args "admin_address" "treasury_address" \
		--output-json > .deploy-poe.json
	
	@echo "${GREEN}Deploying Grail Vault...${NC}"
	@${CHARMS} deploy spells/grail_vault.wasm \
		--network testnet \
		--name "GrailVault" \
		--args "admin_address" \
		--output-json > .deploy-vault.json
	
	@echo "${GREEN}Deploying UTXO Verifier...${NC}"
	@${CHARMS} deploy spells/utxo_verifier.wasm \
		--network testnet \
		--name "UTXOVerifier" \
		--output-json > .deploy-utxo.json
	
	@echo "${GREEN}✓ Contracts deployed${NC}"

register-spells:
	@echo "${YELLOW}Registering Charms spells...${NC}"
	@${CHARMS} spell register spells/mint-poe-zkbtc.yaml --network testnet
	@${CHARMS} spell register spells/burn-zkbtc-e.yaml --network testnet
	@${CHARMS} spell register spells/beam-crosschain.yaml --network testnet
	@echo "${GREEN}✓ Spells registered${NC}"

start-oracle:
	@echo "${YELLOW}Starting Oracle service...${NC}"
	@cd oracle-service && ${DOCKER_COMPOSE} up -d
	@sleep 10
	@echo "${GREEN}✓ Oracle service started${NC}"

## Start development services
dev: start-oracle start-web

start-web:
	@echo "${YELLOW}Starting web development server...${NC}"
	@cd web-app && ${NPM} run dev &
	@echo "${GREEN}Web server: http://localhost:3000${NC}"

## Clean build artifacts
clean:
	@echo "${YELLOW}Cleaning build artifacts...${NC}"
	${CARGO} clean
	rm -rf spells/*.wasm
	rm -rf web-app/dist web-app/node_modules
	rm -f .deploy-*.json deployment.json
	@echo "${GREEN}✓ Clean complete${NC}"

## Run integration tests
integration-test:
	@echo "${YELLOW}Running integration tests...${NC}"
	./scripts/test.sh --integration

## Generate deployment report
report:
	@echo "${YELLOW}Generating deployment report...${NC}"
	@if [ -f .deploy-poe.json ] && [ -f .deploy-vault.json ] && [ -f .deploy-utxo.json ]; then \
		echo "{" > deployment.json; \
		echo '  "timestamp": "'$(date -Iseconds)'",' >> deployment.json; \
		echo '  "network": "bitcoinos-testnet",' >> deployment.json; \
		echo '  "contracts": {' >> deployment.json; \
		echo '    "poe_zkbtc_minter": "'$$(jq -r '.contract_address' .deploy-poe.json)'",' >> deployment.json; \
		echo '    "grail_vault": "'$$(jq -r '.contract_address' .deploy-vault.json)'",' >> deployment.json; \
		echo '    "utxo_verifier": "'$$(jq -r '.contract_address' .deploy-utxo.json)'"' >> deployment.json; \
		echo '  },' >> deployment.json; \
		echo '  "web_app": "http://localhost:3000",' >> deployment.json; \
		echo '  "oracle": "http://localhost:8080"' >> deployment.json; \
		echo "}" >> deployment.json; \
		cat deployment.json; \
	else \
		echo "${RED}No deployment data found${NC}"; \
	fi

## Display help
help:
	@echo "${GREEN}Bit-Earth Labs PoE System Makefile${NC}"
	@echo ""
	@echo "${YELLOW}Available targets:${NC}"
	@echo "  ${GREEN}make init${NC}          - Initialize development environment"
	@echo "  ${GREEN}make build${NC}         - Build all components"
	@echo "  ${GREEN}make test${NC}          - Run all tests"
	@echo "  ${GREEN}make deploy${NC}        - Deploy to BitcoinOS Testnet"
	@echo "  ${GREEN}make dev${NC}           - Start development services"
	@echo "  ${GREEN}make integration-test${NC} - Run integration tests"
	@echo "  ${GREEN}make clean${NC}         - Clean build artifacts"
	@echo "  ${GREEN}make report${NC}        - Generate deployment report"
	@echo "  ${GREEN}make help${NC}          - Show this help"
	@echo ""
	@echo "${YELLOW}Environment variables:${NC}"
	@echo "  BITCOINOS_RPC     - BitcoinOS RPC endpoint"
	@echo "  CHARMS_API_KEY    - Charms SDK API key"
	@echo "  ORACLE_PRIVATE_KEY - Oracle service private key"
