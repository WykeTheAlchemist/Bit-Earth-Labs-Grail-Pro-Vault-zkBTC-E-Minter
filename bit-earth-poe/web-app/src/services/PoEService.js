// Bit-Earth Labs Frontend Service
// Connects to BitcoinOS wallet and displays prosumer dashboard

import { CharmsSDK } from '@charms/sdk';
import { BitcoinOSWallet } from '@bitcoinos/wallet';
import { PoseidonHasher } from './zk/crypto';

export class PoEService {
    constructor() {
        this.charms = new CharmsSDK({
            network: 'bitcoinos-testnet',
            apiKey: process.env.REACT_APP_CHARMS_API_KEY,
        });
        
        this.wallet = null;
        this.contracts = {};
        this.proverUrl = process.env.REACT_APP_PROVER_URL;
    }
    
    async connectWallet() {
        try {
            // Connect to BitcoinOS wallet
            this.wallet = new BitcoinOSWallet();
            await this.wallet.connect();
            
            // Load contracts
            await this.loadContracts();
            
            return {
                address: this.wallet.getAddress(),
                network: 'BitcoinOS Testnet',
                balance: await this.getBalance(),
            };
        } catch (error) {
            console.error('Wallet connection failed:', error);
            throw error;
        }
    }
    
    async loadContracts() {
        // Load PoE minter contract
        this.contracts.poeMinter = await this.charms.loadContract(
            'poe-zkbtc-minter.wasm',
            process.env.REACT_APP_POE_CONTRACT_ADDRESS
        );
        
        // Load Grail Vault contract
        this.contracts.grailVault = await this.charms.loadContract(
            'grail-vault.wasm',
            process.env.REACT_APP_VAULT_ADDRESS
        );
    }
    
    async getProsumerDashboard(deviceId) {
        if (!this.wallet) throw new Error('Wallet not connected');
        
        // Convert device ID to hash
        const deviceIdHash = PoseidonHasher.hash(deviceId);
        
        // Query contract for device data
        const [deviceStatus, energyTotal, walletMapping] = await Promise.all([
            this.contracts.poeMinter.query('certified_devices', [deviceIdHash]),
            this.contracts.poeMinter.query('device_energy_total', [deviceIdHash]),
            this.contracts.poeMinter.query('device_to_wallet', [deviceIdHash]),
        ]);
        
        // Get zkBTC-E balance
        const balance = await this.getBalance();
        
        // Get recent PoE events
        const events = await this.charms.queryEvents('PoEMinted', {
            filter: { device_id: deviceIdHash },
            fromBlock: 'latest-1000',
        });
        
        // Get vault backing status
        const backingStatus = await this.contracts.grailVault.query(
            'total_backing_usd',
            []
        );
        
        return {
            device: {
                id: deviceId,
                status: deviceStatus,
                totalEnergyMWh: (energyTotal || 0) / 1_000_000,
                mappedWallet: walletMapping,
            },
            balance: {
                zkbtcE: balance,
                usdValue: balance * 70,
            },
            recentMints: events.map(e => ({
                amount: e.data.tokens_to_mint,
                timestamp: e.block_timestamp,
                txHash: e.transaction_hash,
            })),
            vault: {
                totalBackingUSD: backingStatus,
                backingRatio: (backingStatus / (balance * 70)) * 100,
            },
        };
    }
    
    async requestBurn(amount, targetChain, targetAddress) {
        if (!this.wallet) throw new Error('Wallet not connected');
        
        // Generate zk-SNARK proof for burn
        const burnProof = await this.generateBurnProof(amount);
        
        // Prepare spell inputs
        const spellInputs = {
            amount,
            target_chain: targetChain,
            target_address: targetAddress,
            burn_proof: Buffer.from(JSON.stringify(burnProof)).toString('base64'),
        };
        
        // Cast burn spell
        const result = await this.charms.castSpell('burn-zkbtc-e', spellInputs, {
            signer: this.wallet,
            gasLimit: '500000',
        });
        
        return {
            txHash: result.transaction_hash,
            bridgeId: result.bridge_id,
            estimatedTime: '2-5 minutes',
        };
    }
    
    async generateBurnProof(amount) {
        // Connect to zk-SNARK prover service
        const response = await fetch(`${this.proverUrl}/generate-burn-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                sender: this.wallet.getAddress(),
                timestamp: Date.now(),
            }),
        });
        
        return response.json();
    }
    
    async getCrossChainAssets() {
        // Query supported chains and their backing assets
        return [
            {
                chain: 'Bitcoin',
                symbol: 'BTC',
                icon: '₿',
                minAmount: 0.001,
                fee: 0.0001,
                time: '10-30 min',
            },
            {
                chain: 'Cardano',
                symbol: 'ADA',
                icon: 'A',
                minAmount: 10,
                fee: 1,
                time: '1-2 min',
            },
            {
                chain: 'Monero',
                symbol: 'XMR',
                icon: 'M',
                minAmount: 0.01,
                fee: 0.0001,
                time: '20 min',
                privacy: 'High',
            },
            {
                chain: 'Ethereum',
                symbol: 'ETH',
                icon: 'Ξ',
                minAmount: 0.01,
                fee: 0.001,
                time: '2-5 min',
            },
        ];
    }
    
    async getBalance() {
        if (!this.wallet) return 0;
        
        // Query zkBTC-E balance from contract
        const balance = await this.contracts.poeMinter.query(
            'balance_of',
            [this.wallet.getAddress()]
        );
        
        return balance || 0;
    }
    
    // Monitor UTXO payments from consumers
    async monitorConsumerPayments(meterId) {
        // Subscribe to Bitcoin/Litecoin/Cardano UTXO events
        // This would connect to Blockstream, Blockfrost, etc APIs
        
        const paymentWatcher = setInterval(async () => {
            const payments = await this.checkUTXOPayments(meterId);
            
            if (payments.length > 0) {
                // Trigger oracle verification and minting
                this.triggerPoEMinting(payments[0]);
            }
        }, 30000); // Check every 30 seconds
        
        return () => clearInterval(paymentWatcher);
    }
    
    async checkUTXOPayments(meterId) {
        // In production: Query blockchain for payments to meter address
        // For demo, return simulated data
        
        return [
            {
                txId: 'abc123...',
                amount: 0.005, // BTC
                meterId,
                timestamp: Date.now(),
                confirmed: true,
            },
        ];
    }
    
    async triggerPoEMinting(payment) {
        // This would be called by oracle when payment is confirmed
        // and energy generation is verified
        
        const spellInputs = {
            poe_packet: await this.getLatestPoEPacket(payment.meterId),
            utxo_proof: payment.txId,
            consumer_wallet: payment.fromAddress,
        };
        
        // Auto-cast minting spell
        await this.charms.castSpell('mint-poe-zkbtc-e', spellInputs, {
            signer: 'oracle', // Oracle signs this
        });
    }
}
