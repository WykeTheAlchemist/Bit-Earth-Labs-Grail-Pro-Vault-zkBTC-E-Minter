// Wallet Integration Example
// Description: Example code for wallet integration with Bit-Earth PoE system

import { CharmsSDK } from '@charms/sdk';
import { BitcoinOSWallet, BitcoinWallet, CardanoWallet } from '@bitcoinos/wallet';
import { PoEService } from '../web-app/src/services/PoEService.js';

/**
 * Example: Connecting various wallets to Bit-Earth system
 */
class WalletIntegrationExample {
    constructor() {
        this.poeService = new PoEService();
        this.wallets = {};
    }
    
    /**
     * Connect BitcoinOS wallet (main wallet for zkBTC-E)
     */
    async connectBitcoinOSWallet() {
        try {
            console.log('Connecting BitcoinOS wallet...');
            
            this.wallets.bitcoinos = new BitcoinOSWallet({
                network: 'testnet',
                rpcUrl: process.env.BITCOINOS_RPC,
            });
            
            await this.wallets.bitcoinos.connect();
            
            const address = this.wallets.bitcoinos.getAddress();
            console.log(`Connected: ${address.substring(0, 20)}...`);
            
            // Initialize PoE service with wallet
            await this.poeService.connectWallet(this.wallets.bitcoinos);
            
            return {
                success: true,
                address,
                network: 'BitcoinOS Testnet',
            };
        } catch (error) {
            console.error('BitcoinOS wallet connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Connect Bitcoin wallet for UTXO payments
     */
    async connectBitcoinWallet() {
        try {
            console.log('Connecting Bitcoin wallet...');
            
            this.wallets.bitcoin = new BitcoinWallet({
                network: 'testnet',
                derivationPath: "m/44'/1'/0'/0/0",
            });
            
            await this.wallets.bitcoin.connect();
            
            const address = this.wallets.bitcoin.getAddress();
            console.log(`Connected: ${address}`);
            
            return {
                success: true,
                address,
                network: 'Bitcoin Testnet',
            };
        } catch (error) {
            console.error('Bitcoin wallet connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Connect Cardano wallet for UTXO payments
     */
    async connectCardanoWallet() {
        try {
            console.log('Connecting Cardano wallet...');
            
            this.wallets.cardano = new CardanoWallet({
                network: 'testnet',
            });
            
            await this.wallets.cardano.enable();
            
            const addresses = await this.wallets.cardano.getUsedAddresses();
            const address = addresses[0];
            
            console.log(`Connected: ${address.substring(0, 20)}...`);
            
            return {
                success: true,
                address,
                network: 'Cardano Testnet',
            };
        } catch (error) {
            console.error('Cardano wallet connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Make a UTXO payment to a smart meter
     */
    async makeUTXOPayment(meterAddress, amount, asset = 'BTC') {
        if (!this.wallets[asset.toLowerCase()]) {
            throw new Error(`No ${asset} wallet connected`);
        }
        
        console.log(`Making ${asset} payment to meter: ${meterAddress}`);
        
        try {
            const wallet = this.wallets[asset.toLowerCase()];
            
            // Create transaction
            const tx = await wallet.createTransaction({
                to: meterAddress,
                amount: amount,
                memo: `PoE Payment - Meter: ${meterAddress.substring(0, 10)}...`,
            });
            
            // Sign transaction
            const signedTx = await wallet.signTransaction(tx);
            
            // Broadcast transaction
            const txId = await wallet.broadcastTransaction(signedTx);
            
            console.log(`Payment sent! Transaction ID: ${txId}`);
            
            // Monitor confirmation
            await this.monitorPaymentConfirmation(txId, asset);
            
            return {
                success: true,
                txId,
                amount,
                asset,
                meterAddress,
            };
        } catch (error) {
            console.error('Payment failed:', error);
            throw error;
        }
    }
    
    /**
     * Monitor payment confirmation
     */
    async monitorPaymentConfirmation(txId, asset) {
        console.log(`Monitoring ${asset} transaction: ${txId}`);
        
        const maxAttempts = 30;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const wallet = this.wallets[asset.toLowerCase()];
                const confirmation = await wallet.getTransactionConfirmations(txId);
                
                if (confirmation >= 1) {
                    console.log(`Transaction confirmed! Confirmations: ${confirmation}`);
                    
                    // Payment confirmed, trigger PoE verification
                    await this.triggerPoEVerification(txId, asset);
                    break;
                }
                
                console.log(`Waiting for confirmation... (${i + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
            } catch (error) {
                console.error('Error checking confirmation:', error);
            }
        }
    }
    
    /**
     * Trigger PoE verification after payment confirmation
     */
    async triggerPoEVerification(txId, asset) {
        console.log('Triggering PoE verification...');
        
        // This would call the oracle service to verify the payment
        // and trigger minting if energy was generated
        
        const verificationData = {
            txId,
            asset,
            timestamp: Date.now(),
            verifiedBy: this.wallets.bitcoinos.getAddress(),
        };
        
        // Send to oracle
        const response = await fetch('http://localhost:8080/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verificationData),
        });
        
        if (response.ok) {
            console.log('PoE verification triggered successfully');
        } else {
            console.error('Failed to trigger PoE verification');
        }
    }
    
    /**
     * Check zkBTC-E balance
     */
    async checkzkBTCBalance() {
        if (!this.wallets.bitcoinos) {
            throw new Error('BitcoinOS wallet not connected');
        }
        
        const balance = await this.poeService.getBalance();
        console.log(`zkBTC-E Balance: ${balance} tokens`);
        
        // Convert to USD value
        const usdValue = balance * 70;
        console.log(`USD Value: $${usdValue}`);
        
        return { balance, usdValue };
    }
    
    /**
     * Burn zkBTC-E for backing assets
     */
    async burnForAssets(amount, targetChain, targetAddress) {
        if (!this.wallets.bitcoinos) {
            throw new Error('BitcoinOS wallet not connected');
        }
        
        console.log(`Burning ${amount} zkBTC-E for ${targetChain} assets...`);
        
        const result = await this.poeService.requestBurn(
            amount,
            targetChain,
            targetAddress
        );
        
        console.log(`Burn initiated! Bridge ID: ${result.bridgeId}`);
        console.log(`Estimated arrival: ${result.estimatedTime}`);
        
        return result;
    }
    
    /**
     * Example usage
     */
    async runExample() {
        console.log('=== Bit-Earth Wallet Integration Example ===\n');
        
        try {
            // 1. Connect wallets
            console.log('1. Connecting wallets...');
            await this.connectBitcoinOSWallet();
            await this.connectBitcoinWallet();
            await this.connectCardanoWallet();
            
            // 2. Check balance
            console.log('\n2. Checking zkBTC-E balance...');
            await this.checkzkBTCBalance();
            
            // 3. Make a test payment (simulated)
            console.log('\n3. Making test payment...');
            const meterAddress = 'tb1qmeteraddress1234567890abcdefghijklmnop';
            const payment = await this.makeUTXOPayment(meterAddress, 0.001, 'BTC');
            
            // 4. Burn example (if you have tokens)
            console.log('\n4. Burn example (commented out)');
            /*
            const burnResult = await this.burnForAssets(
                1.5,
                'bitcoin',
                'tb1qrecipientaddress1234567890abcdefgh'
            );
            console.log('Burn result:', burnResult);
            */
            
            console.log('\n=== Example Complete ===');
            
        } catch (error) {
            console.error('Example failed:', error);
        }
    }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const example = new WalletIntegrationExample();
    example.runExample().catch(console.error);
}

export default WalletIntegrationExample;
