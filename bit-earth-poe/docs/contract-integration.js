import { CharmsSDK } from '@charms/sdk';

const charms = new CharmsSDK({
  network: 'testnet',
  apiKey: 'your_api_key'
});

// Load PoE contract
const poeContract = await charms.loadContract(
  'poe-zkbtc-minter.wasm',
  'contract_address_here'
);

// Call contract methods
const deviceStatus = await poeContract.query('certified_devices', [deviceIdHash]);
const totalMinted = await poeContract.query('total_minted', []);
const prosumerWallet = await poeContract.query('device_to_wallet', [deviceIdHash]);

// Execute contract methods
const result = await poeContract.execute('mint_with_poe', {
  poe_packet: packet,
  zk_proof: proof,
  utxo_proof: utxoProof
}, {
  signer: wallet,
  value: '0',
  gasLimit: '500000'
});
