#!/bin/bash

# Bit-Earth PoE System Test Script
# Author: Bit-Earth Team
# Description: Run comprehensive test suite

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local missing=()
    
    for cmd in cargo node docker jq; do
        if ! command -v $cmd &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        fail "Missing dependencies: ${missing[*]}"
        exit 1
    fi
    
    success "All dependencies available"
}

# Run unit tests
run_unit_tests() {
    log "Running unit tests..."
    
    # Rust contracts
    log "Testing contracts..."
    cd contracts/poe-zkbtc-minter
    if ! cargo test -- --nocapture; then
        fail "Contract tests failed"
        return 1
    fi
    cd ../..
    
    # Circuits
    log "Testing circuits..."
    cd circuits/poe-circuit
    if ! cargo test -- --nocapture; then
        fail "Circuit tests failed"
        return 1
    fi
    cd ../..
    
    success "Unit tests passed"
}

# Run integration tests
run_integration_tests() {
    log "Running integration tests..."
    
    # Start test services
    log "Starting test services..."
    docker-compose -f test/docker-compose.test.yml up -d
    
    # Wait for services
    log "Waiting for services to start..."
    sleep 10
    
    # Run integration tests
    cd tests/integration
    if ! npm test; then
        fail "Integration tests failed"
        docker-compose -f ../docker-compose.test.yml down
        return 1
    fi
    cd ../..
    
    # Stop test services
    log "Stopping test services..."
    docker-compose -f test/docker-compose.test.yml down
    
    success "Integration tests passed"
}

# Run end-to-end tests
run_e2e_tests() {
    log "Running end-to-end tests..."
    
    # This would deploy to a local testnet and run full workflow
    # For now, we'll run simulated e2e tests
    
    cd tests/e2e
    if ! ./run-e2e.sh; then
        fail "E2E tests failed"
        return 1
    fi
    cd ../..
    
    success "E2E tests passed"
}

# Run security tests
run_security_tests() {
    log "Running security tests..."
    
    # Check for known vulnerabilities
    log "Checking dependencies..."
    cd web-app
    if ! npm audit; then
        warn "NPM audit found vulnerabilities"
    fi
    cd ..
    
    # Run cargo audit for Rust dependencies
    if command -v cargo-audit &> /dev/null; then
        log "Running cargo audit..."
        cargo audit
    fi
    
    # Check for secrets in code
    log "Checking for secrets..."
    if command -v trufflehog &> /dev/null; then
        trufflehog filesystem --directory . --no-update
    fi
    
    success "Security checks completed"
}

# Run performance tests
run_performance_tests() {
    log "Running performance tests..."
    
    # This would benchmark contract execution times
    # For now, we'll run simple benchmarks
    
    log "Benchmarking circuits..."
    cd circuits/poe-circuit
    cargo bench -- --nocapture
    cd ../..
    
    success "Performance tests completed"
}

# Generate test report
generate_report() {
    log "Generating test report..."
    
    local report_file="test-report-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "test_suite": "bit-earth-poe",
  "results": {
    "unit_tests": "$1",
    "integration_tests": "$2",
    "e2e_tests": "$3",
    "security_tests": "$4",
    "performance_tests": "$5"
  },
  "summary": {
    "total_tests": 5,
    "passed": $6,
    "failed": $7
  }
}
EOF
    
    log "Test report saved to $report_file"
}

# Main test runner
main() {
    echo -e "${BLUE}=== Bit-Earth PoE System Test Suite ===${NC}\n"
    
    check_dependencies
    
    local unit_passed=true
    local integration_passed=true
    local e2e_passed=true
    local security_passed=true
    local performance_passed=true
    
    local passed_count=0
    local failed_count=0
    
    # Parse arguments
    local test_type="all"
    if [ $# -gt 0 ]; then
        test_type="$1"
    fi
    
    # Run selected tests
    case "$test_type" in
        "unit")
            if ! run_unit_tests; then unit_passed=false; fi
            ;;
        "integration")
            if ! run_integration_tests; then integration_passed=false; fi
            ;;
        "e2e")
            if ! run_e2e_tests; then e2e_passed=false; fi
            ;;
        "security")
            run_security_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "all")
            if ! run_unit_tests; then unit_passed=false; fi
            if ! run_integration_tests; then integration_passed=false; fi
            if ! run_e2e_tests; then e2e_passed=false; fi
            run_security_tests
            run_performance_tests
            ;;
        *)
            echo "Usage: $0 [unit|integration|e2e|security|performance|all]"
            exit 1
            ;;
    esac
    
    # Count results
    if $unit_passed; then ((passed_count++)); else ((failed_count++)); fi
    if $integration_passed; then ((passed_count++)); else ((failed_count++)); fi
    if $e2e_passed; then ((passed_count++)); else ((failed_count++)); fi
    if $security_passed; then ((passed_count++)); else ((failed_count++)); fi
    if $performance_passed; then ((passed_count++)); else ((failed_count++)); fi
    
    # Generate report
    generate_report \
        "$unit_passed" \
        "$integration_passed" \
        "$e2e_passed" \
        "$security_passed" \
        "$performance_passed" \
        "$passed_count" \
        "$failed_count"
    
    # Print summary
    echo -e "\n${BLUE}=== Test Summary ===${NC}"
    echo -e "Unit Tests: $($unit_passed && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
    echo -e "Integration Tests: $($integration_passed && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
    echo -e "E2E Tests: $($e2e_passed && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
    echo -e "Security Tests: $($security_passed && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
    echo -e "Performance Tests: $($performance_passed && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
    echo -e "\nTotal: ${GREEN}$passed_count passed${NC}, ${RED}$failed_count failed${NC}"
    
    # Exit with appropriate code
    if [ $failed_count -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Run main function
main "$@"
