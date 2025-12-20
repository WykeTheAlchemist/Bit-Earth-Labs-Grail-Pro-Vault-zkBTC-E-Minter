# Integration Guide

## Overview

This guide explains how to integrate various components with the Bit-Earth PoE system. The system is designed to be modular and supports multiple integration points for wallets, IoT devices, oracles, and third-party services.

## Table of Contents

1. [Wallet Integration](#wallet-integration)
2. [IoT Device Integration](#iot-device-integration)
3. [Oracle Service Integration](#oracle-service-integration)
4. [Smart Contract Integration](#smart-contract-integration)
5. [API Reference](#api-reference)
6. [Webhook Integration](#webhook-integration)
7. [Mobile App Integration](#mobile-app-integration)
8. [Enterprise Integration](#enterprise-integration)

## Wallet Integration

### Supported Wallets

The system supports the following wallet types:

1. **BitcoinOS Wallets** (Primary for zkBTC-E)
2. **Bitcoin/Litecoin Wallets** (UTXO payments)
3. **Cardano Wallets** (UTXO payments)
4. **EVM Wallets** (Ethereum, Polygon, etc.)
5. **Hardware Wallets** (Ledger, Trezor)

### Integration Examples

#### JavaScript/TypeScript

```javascript
import { PoEService } from '@bit-earth/poe-sdk';

// Initialize service
const poeService = new PoEService({
  network: 'testnet', // or 'mainnet'
  rpcUrl: 'https://testnet.bitcoinos.org',
});

// Connect wallet
const wallet = await poeService.connectWallet('bitcoinos', {
  derivationPath: "m/44'/5757'/0'/0/0",
});

// Check balance
const balance = await poeService.getBalance();
console.log(`Balance: ${balance} zkBTC-E`);

// Make UTXO payment
const payment = await poeService.makePayment({
  to: 'meter_tb1q...',
  amount: 0.001,
  currency: 'BTC',
  memo: 'Energy payment',
});

// Burn tokens
const burnResult = await poeService.burnTokens({
  amount: 1.5,
  targetChain: 'bitcoin',
  targetAddress: 'tb1q...',
});
