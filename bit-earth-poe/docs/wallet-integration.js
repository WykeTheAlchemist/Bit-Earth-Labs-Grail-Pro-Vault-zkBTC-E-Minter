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
