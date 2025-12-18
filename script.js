/**
 * Bit-Earth Labs: PoE zkBTC-E Minting Simulator
 * Main JavaScript file
 */

// Global state
const AppState = {
    energyData: [],
    totalEnergy: 0,
    mintedTokens: 0,
    prosumerShare: 0,
    treasuryShare: 0,
    transactionHistory: [],
    selectedAsset: null,
    currentWallet: '',
    
    // Supported assets for burning
    assets: [
        { 
            id: 'bitcoin', 
            name: 'Bitcoin', 
            symbol: 'BTC', 
            icon: '₿', 
            color: '#F7931A', 
            regex: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/ 
        },
        { 
            id: 'cardano', 
            name: 'Cardano', 
            symbol: 'ADA', 
            icon: 'A', 
            color: '#0033AD', 
            regex: /^addr1[a-z0-9]+$/ 
        },
        { 
            id: 'monero', 
            name: 'Monero', 
            symbol: 'XMR', 
            icon: 'M', 
            color: '#FF6600', 
            regex: /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/ 
        },
        { 
            id: 'dogecoin', 
            name: 'Dogecoin', 
            symbol: 'DOGE', 
            icon: 'Ð', 
            color: '#C2A633', 
            regex: /^D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}$/ 
        },
        { 
            id: 'zcash', 
            name: 'ZCash', 
            symbol: 'ZEC', 
            icon: 'ⓩ', 
            color: '#F4B728', 
            regex: /^t1[a-zA-Z0-9]{33}$/ 
        },
        { 
            id: 'sovryn-dollar', 
            name: 'Sovryn Dollar', 
            symbol: 'DLLR', 
            icon: '$', 
            color: '#F5A623', 
            regex: /^0x[a-fA-F0-9]{40}$/ 
        }
    ],
    
    // Minting formulas for display
    formulas: [
        "zkBTC-E = Σ(|ΔV| × 10 × η) × 1.0",
        "ΔV = Voltage change per hour",
        "η = Device efficiency (0.85-0.95)",
        "1.0 = PoE Protocol Constant",
        "Backing: 1 zkBTC-E = $70 in assets"
    ],
    currentFormulaIndex: 0
};

// DOM Elements
const DOM = {
    // File upload
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    processBtn: document.getElementById('processBtn'),
    
    // Steps
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3'),
    step4: document.getElementById('step4'),
    
    // Results
    resultsSection: document.getElementById('resultsSection'),
    energyGenerated: document.getElementById('energyGenerated'),
    zkBTCMinted: document.getElementById('zkBTCMinted'),
    toProsumer: document.getElementById('toProsumer'),
    toTreasury: document.getElementById('toTreasury'),
    
    // ZK Proof
    proofContent: document.getElementById('proofContent'),
    
    // Wallet
    walletAddress: document.getElementById('walletAddress'),
    
    // Bridge
    bridgeBtn: document.getElementById('bridgeBtn'),
    txLink: document.getElementById('txLink'),
    
    // Burn mechanism
    assetSelector: document.getElementById('assetSelector'),
    burnControls: document.getElementById('burnControls'),
    availableToBurn: document.getElementById('availableToBurn'),
    assetWalletAddress: document.getElementById('assetWalletAddress'),
    burnBtn: document.getElementById('burnBtn'),
    
    // Tokenomics
    prosumerBar: document.getElementById('prosumerBar'),
    treasuryBar: document.getElementById('treasuryBar'),
    formulaDisplay: document.getElementById('formulaDisplay'),
    
    // Explorer modal
    explorerModal: document.getElementById('explorerModal'),
    explorerWalletAddress: document.getElementById('explorerWalletAddress'),
    explorerBalance: document.getElementById('explorerBalance'),
    txList: document.getElementById('txList'),
    fullExplorerBtn: document.getElementById('fullExplorerBtn'),
    refreshTxBtn: document.getElementById('refreshTxBtn'),
    
    // Sample data hint
    sampleDataLine: document.getElementById('sampleDataLine')
};

// Initialize application
function initApp() {
    setupEventListeners();
    generateSampleData();
    startFormulaRotation();
}

// Setup all event listeners
function setupEventListeners() {
    // File upload
    DOM.uploadArea.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFileUpload);
    
    // Drag and drop
    DOM.uploadArea.addEventListener('dragover', handleDragOver);
    DOM.uploadArea.addEventListener('dragleave', handleDragLeave);
    DOM.uploadArea.addEventListener('drop', handleDrop);
    
    // Process button
    DOM.processBtn.addEventListener('click', processEnergyData);
    
    // Bridge button
    DOM.bridgeBtn.addEventListener('click', simulateCrossChainBridge);
    
    // Burn button
    DOM.burnBtn.addEventListener('click', burnForAssets);
    
    // Explorer modal
    document.querySelector('.close-explorer').addEventListener('click', closeExplorer);
    DOM.fullExplorerBtn.addEventListener('click', () => {
        window.open('https://explorer.bitcoinos.org', '_blank');
    });
    DOM.refreshTxBtn.addEventListener('click', refreshTransactions);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            filterTransactions(filter);
        });
    });
    
    // Transaction link
    DOM.txLink.addEventListener('click', (e) => {
        e.preventDefault();
        openBitcoinOSExplorer();
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === DOM.explorerModal) {
            closeExplorer();
        }
    });
    
    // Update wallet on input
    DOM.walletAddress.addEventListener('input', (e) => {
        AppState.currentWallet = e.target.value;
    });
}

// Generate sample data for demo
function generateSampleData() {
    const sampleData = [];
    const now = Date.now();
    
    // Generate 24 hours of sample data
    for (let i = 0; i < 24; i++) {
        const timestamp = now - (i * 3600000);
        const voltageChange = -(Math.random() * 0.8 + 0.2).toFixed(2);
        sampleData.push(`${timestamp},${voltageChange}`);
    }
    
    // Display one sample line
    if (DOM.sampleDataLine) {
        DOM.sampleDataLine.textContent = sampleData[0];
    }
}

// Rotate formulas in the display
function startFormulaRotation() {
    setInterval(() => {
        DOM.formulaDisplay.textContent = AppState.formulas[AppState.currentFormulaIndex];
        AppState.currentFormulaIndex = (AppState.currentFormulaIndex + 1) % AppState.formulas.length;
    }, 3000);
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            AppState.energyData = parseDataFile(content);
            
            if (AppState.energyData.length > 0) {
                DOM.processBtn.disabled = false;
                DOM.step1.classList.add('step-active');
                showNotification('Data loaded successfully!', 'success');
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            showNotification('Error parsing file. Please check the format.', 'error');
        }
    };
    
    reader.onerror = function() {
        showNotification('Error reading file.', 'error');
    };
    
    reader.readAsText(file);
}

// Parse data file content
function parseDataFile(content) {
    const lines = content.split('\n');
    const data = [];
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        const parts = trimmedLine.split(',');
        if (parts.length >= 2) {
            const timestamp = parseInt(parts[0], 10);
            const voltageChange = parseFloat(parts[1]);
            
            if (!isNaN(timestamp) && !isNaN(voltageChange)) {
                data.push({
                    timestamp: timestamp,
                    voltageChange: Math.abs(voltageChange),
                    originalChange: voltageChange
                });
            }
        }
    });
    
    return data;
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.style.background = 'rgba(0, 194, 255, 0.1)';
    e.currentTarget.style.borderColor = '#00E676';
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.style.background = '';
    e.currentTarget.style.borderColor = '';
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.style.background = '';
    e.currentTarget.style.borderColor = '';
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.txt')) {
        DOM.fileInput.files = e.dataTransfer.files;
        handleFileUpload({ target: DOM.fileInput });
    } else {
        showNotification('Please upload a .txt file', 'error');
    }
}

// Main processing function
function processEnergyData() {
    if (AppState.energyData.length === 0) {
        showNotification('No data to process', 'error');
        return;
    }
    
    // Show results section
    DOM.resultsSection.classList.remove('hidden');
    DOM.step2.classList.add('step-active');
    
    // Calculate total energy
    AppState.totalEnergy = AppState.energyData.reduce((sum, entry) => {
        return sum + (entry.voltageChange * 10);
    }, 0);
    
    // Calculate minted tokens (0.001 conversion factor)
    AppState.mintedTokens = AppState.totalEnergy * 0.001;
    
    // Start animation sequence
    animateCounter(DOM.energyGenerated, 0, AppState.totalEnergy, 2, ' kWh');
    
    setTimeout(() => {
        DOM.step3.classList.add('step-active');
        animateCounter(DOM.zkBTCMinted, 0, AppState.mintedTokens, 6);
        
        // Calculate distribution (85% prosumer, 15% treasury)
        AppState.prosumerShare = AppState.mintedTokens * 0.85;
        AppState.treasuryShare = AppState.mintedTokens * 0.15;
        
        setTimeout(() => {
            DOM.step4.classList.add('step-active');
            animateCounter(DOM.toProsumer, 0, AppState.prosumerShare, 6);
            animateCounter(DOM.toTreasury, 0, AppState.treasuryShare, 6);
            
            // Update progress bars
            DOM.prosumerBar.style.width = '85%';
            DOM.treasuryBar.style.width = '15%';
            
            // Generate ZK proof
            generateZKProof();
            
            // Add mint transaction to history
            addTransactionToHistory({
                type: 'mint',
                amount: AppState.mintedTokens.toFixed(6),
                token: 'zkBTC-E',
                status: 'confirmed',
                timestamp: Date.now(),
                details: 'PoE Mint from Energy Generation'
            });
            
            // Enable bridge button
            DOM.bridgeBtn.disabled = false;
            
            // Initialize burn section
            DOM.availableToBurn.textContent = AppState.prosumerShare.toFixed(6);
            initializeAssetSelector();
            
            showNotification('zkBTC-E Minting Complete!', 'success');
        }, 500);
    }, 500);
}

// Animate counter from start to end
function animateCounter(element, start, end, decimals = 2, suffix = '') {
    const duration = 1500;
    const steps = 60;
    const stepValue = (end - start) / steps;
    let current = start;
    let step = 0;
    
    const timer = setInterval(() => {
        current += stepValue;
        step++;
        
        if (step >= steps) {
            current = end;
            clearInterval(timer);
        }
        
        element.textContent = current.toFixed(decimals) + suffix;
        element.classList.add('minting-animation');
        
        setTimeout(() => {
            element.classList.remove('minting-animation');
        }, 300);
    }, duration / steps);
}

// Generate ZK proof (simulated)
function generateZKProof() {
    const proofData = {
        protocol: "PoE zkBTC-E",
        version: "1.0",
        timestamp: Date.now(),
        energyHash: generateRandomHash(),
        commitment: generateRandomHash(),
        nullifier: generateRandomHash(),
        merkleRoot: generateRandomHash(),
        circuit: "energy_verification_v1",
        publicSignals: [
            `energy: ${AppState.totalEnergy.toFixed(2)} kWh`,
            `tokens: ${AppState.mintedTokens.toFixed(6)} zkBTC-E`,
            `timestamp: ${new Date().toISOString()}`
        ]
    };
    
    DOM.proofContent.textContent = JSON.stringify(proofData, null, 2);
    
    // Generate random transaction hash
    const txHash = generateRandomHash();
    DOM.txLink.href = `https://explorer.bitcoinos.org/tx/${txHash}`;
}

// Generate random hash for simulation
function generateRandomHash() {
    return '0x' + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)).join('');
}

// Initialize asset selector for burn mechanism
function initializeAssetSelector() {
    DOM.assetSelector.innerHTML = '';
    
    AppState.assets.forEach(asset => {
        const option = document.createElement('div');
        option.className = 'asset-option';
        option.id = `asset-${asset.id}`;
        
        option.innerHTML = `
            <div class="asset-icon" style="color: ${asset.color}">${asset.icon}</div>
            <div style="font-size: 0.9rem; font-weight: bold;">${asset.name}</div>
            <div style="font-size: 0.8rem; color: #88aaff;">${asset.symbol}</div>
        `;
        
        option.addEventListener('click', () => selectAsset(asset));
        DOM.assetSelector.appendChild(option);
    });
}

// Select asset for burning
function selectAsset(asset) {
    AppState.selectedAsset = asset;
    
    // Update UI
    document.querySelectorAll('.asset-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.getElementById(`asset-${asset.id}`).classList.add('selected');
    
    // Show burn controls
    DOM.burnControls.classList.remove('hidden');
    DOM.assetWalletAddress.placeholder = `Enter ${asset.name} wallet address`;
}

// Burn zkBTC-E for backing assets
function burnForAssets() {
    const walletAddress = DOM.assetWalletAddress.value.trim();
    
    if (!AppState.selectedAsset) {
        showNotification('Please select an asset first', 'error');
        return;
    }
    
    if (!walletAddress) {
        showNotification(`Please enter ${AppState.selectedAsset.name} wallet address`, 'error');
        return;
    }
    
    // Validate wallet address format
    if (!AppState.selectedAsset.regex.test(walletAddress)) {
        showNotification(`Invalid ${AppState.selectedAsset.name} wallet address format`, 'error');
        return;
    }
    
    const amountToBurn = AppState.prosumerShare;
    const usdValue = amountToBurn * 70;
    
    showNotification(`Burning ${amountToBurn.toFixed(6)} zkBTC-E...`, 'info');
    
    // Simulate blockchain transaction
    setTimeout(() => {
        // Add burn transaction to history
        addTransactionToHistory({
            type: 'burn',
            amount: amountToBurn.toFixed(6),
            token: `zkBTC-E → ${AppState.selectedAsset.symbol}`,
            status: 'confirmed',
            timestamp: Date.now(),
            details: `Burned for ${AppState.selectedAsset.name} ($${usdValue.toFixed(2)})`
        });
        
        // Update prosumer balance
        AppState.prosumerShare = 0;
        DOM.toProsumer.textContent = '0';
        DOM.availableToBurn.textContent = '0';
        
        // Show success message
        const burnResult = document.createElement('div');
        burnResult.className = 'success-message';
        burnResult.innerHTML = `
            <h3 style="color: #FF6B6B; margin-bottom: 10px;">
                <i class="fas fa-check-circle"></i> Burn Complete
            </h3>
            <p style="color: #88aaff;">
                Successfully burned <strong>${amountToBurn.toFixed(6)} zkBTC-E</strong>
            </p>
            <p style="color: #88aaff; margin-top: 10px;">
                Value: <strong>$${usdValue.toFixed(2)}</strong> in ${AppState.selectedAsset.name}
            </p>
            <p style="color: #88aaff; margin-top: 10px;">
                Sent to: <code>${walletAddress.substring(0, 20)}...</code>
            </p>
            <div style="display: flex; align-items: center; gap: 15px; margin-top: 15px;">
                <div style="font-size: 2rem;">🔥</div>
                <div style="font-size: 1.5rem;">→</div>
                <div class="chain-icon" style="background: ${AppState.selectedAsset.color}">${AppState.selectedAsset.icon}</div>
            </div>
        `;
        
        DOM.burnControls.parentNode.insertBefore(burnResult, DOM.burnControls.nextSibling);
        showNotification(`$${usdValue.toFixed(2)} ${AppState.selectedAsset.name} sent to your wallet!`, 'success');
        
        // Reset selection
        AppState.selectedAsset = null;
        document.querySelectorAll('.asset-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        DOM.assetWalletAddress.value = '';
        DOM.burnControls.classList.add('hidden');
        
    }, 2000);
}

// Simulate cross-chain bridge
function simulateCrossChainBridge() {
    const walletAddress = DOM.walletAddress.value.trim();
    
    if (!walletAddress || !walletAddress.startsWith('addr1')) {
        showNotification('Please enter a valid Cardano wallet address', 'error');
        return;
    }
    
    showNotification('Bridging zkBTC-E to Cardano...', 'info');
    
    setTimeout(() => {
        // Add bridge transaction to history
        addTransactionToHistory({
            type: 'bridge',
            amount: AppState.mintedTokens.toFixed(6),
            token: 'zkBTC-E → ₳',
            status: 'confirmed',
            timestamp: Date.now(),
            details: 'Bridged to Cardano Network'
        });
        
        // Show success message
        const bridgeDiv = document.createElement('div');
        bridgeDiv.className = 'success-message';
        bridgeDiv.innerHTML = `
            <h3 style="color: #00E676; margin-bottom: 10px;">
                <i class="fas fa-bridge"></i> Cross-Chain Bridge Complete
            </h3>
            <p style="color: #88aaff;">
                ${AppState.mintedTokens.toFixed(6)} zkBTC-E bridged to Cardano
            </p>
            <p style="color: #88aaff; margin-top: 10px;">
                Destination: <code>${walletAddress.substring(0, 20)}...</code>
            </p>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <div class="chain-icon bitcoin">₿</div>
                <div style="align-self: center;">→</div>
                <div class="chain-icon cardano">A</div>
            </div>
        `;
        
        DOM.resultsSection.appendChild(bridgeDiv);
        showNotification('Tokens successfully bridged to Cardano!', 'success');
    }, 2000);
}

// Explorer functions
function openBitcoinOSExplorer() {
    const walletAddress = DOM.walletAddress.value || 'addr1q...demo';
    DOM.explorerWalletAddress.textContent = walletAddress.substring(0, 20) + '...';
    DOM.explorerBalance.textContent = AppState.mintedTokens.toFixed(6);
    DOM.explorerModal.style.display = 'block';
    renderTransactionHistory();
}

function closeExplorer() {
    DOM.explorerModal.style.display = 'none';
}

function filterTransactions(type) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter and render transactions
    let filtered = AppState.transactionHistory;
    if (type !== 'all') {
        filtered = AppState.transactionHistory.filter(tx => tx.type === type);
    }
    renderFilteredTransactions(filtered);
}

function refreshTransactions() {
    showNotification('Refreshing transaction history...', 'info');
    renderTransactionHistory();
}

function renderTransactionHistory() {
    if (AppState.transactionHistory.length === 0) {
        DOM.txList.innerHTML = `
            <div class="tx-placeholder">
                <i class="fas fa-history"></i>
                <p>No transactions yet</p>
                <small>Mint zkBTC-E to see transaction history</small>
            </div>
        `;
        return;
    }
    
    renderFilteredTransactions(AppState.transactionHistory);
}

function renderFilteredTransactions(filtered) {
    let html = '';
    
    filtered.forEach(tx => {
        const timeAgo = formatTimeAgo(tx.timestamp);
        const icon = getTransactionIcon(tx.type);
        const statusClass = tx.status === 'confirmed' ? 'confirmed' : 'pending';
        
        html += `
            <div class="tx-item ${tx.type}">
                <div class="tx-icon">${icon}</div>
                <div class="tx-details">
                    <div class="tx-type">${tx.details}</div>
                    <div class="tx-amount">${tx.amount} ${tx.token}</div>
                    <div class="tx-time">${timeAgo}</div>
                </div>
                <div class="tx-status ${statusClass}">${tx.status}</div>
            </div>
        `;
    });
    
    DOM.txList.innerHTML = html;
}

function getTransactionIcon(type) {
    switch(type) {
        case 'mint': return '🪙';
        case 'bridge': return '🌉';
        case 'burn': return '🔥';
        default: return '📄';
    }
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

function addTransactionToHistory(tx) {
    AppState.transactionHistory.unshift(tx);
    
    if (DOM.explorerModal.style.display === 'block') {
        renderTransactionHistory();
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(20px)';
        
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);