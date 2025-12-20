//! Proof-of-Energy zkBTC-E Minter Contract
//! Written by Bit-Earth Labs Team
//! Date: 2025-12-20

#![cfg_attr(not(feature = "std"), no_std)]

use charms_sdk::{
    prelude::*,
    crypto::{sha256, PoseidonHash},
    wasm::{self, *},
    storage::{Map, Vec as StorageVec},
};

/// Device certification status
#[derive(Debug, Clone, Encode, Decode, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum DeviceStatus {
    Pending,
    Certified,
    Suspended,
    Decommissioned,
}

/// Proof-of-Energy data packet from IoT sensor
#[derive(Debug, Clone, Encode, Decode)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct PoEPacket {
    /// Device unique ID (SHA256 of manufacturer cert)
    pub device_id: [u8; 32],
    /// Unix timestamp in milliseconds
    pub timestamp: u64,
    /// Energy generated in watt-hours
    pub energy_wh: u64,
    /// Cumulative energy counter (prevents replay)
    pub cumulative_energy: u128,
    /// Digital signature (Ed25519)
    pub signature: [u8; 64],
    /// Oracle node ID that verified this
    pub oracle_id: [u8; 32],
}

/// Zero-knowledge minting proof
#[derive(Debug, Clone, Encode, Decode)]
pub struct ZkMintProof {
    /// zk-SNARK proof bytes
    pub proof: Vec<u8>,
    /// Public inputs
    pub public_inputs: Vec<[u8; 32]>,
    /// Circuit verification key hash
    pub vk_hash: [u8; 32],
}

/// The main PoE zkBTC-E Minter contract
#[wasm::contract]
pub mod poe_zkbtc_minter {
    use super::*;
    
    #[contract(state)]
    pub struct PoEzkBTCMinter {
        /// Contract admin (DAO multisig)
        #[state]
        pub admin: String,
        
        /// Certified energy devices
        #[state]
        pub certified_devices: Map<[u8; 32], DeviceStatus>,
        
        /// Energy generation per device (for analytics)
        #[state]
        pub device_energy_total: Map<[u8; 32], u128>,
        
        /// Prosumer wallet mappings
        #[state]
        pub device_to_wallet: Map<[u8; 32], String>,
        
        /// Total zkBTC-E minted
        #[state]
        pub total_minted: u64,
        
        /// Burned tokens (for backing redemption)
        #[state]
        pub total_burned: u64,
        
        /// Treasury address for protocol fees
        #[state]
        pub treasury: String,
        
        /// Oracle whitelist
        #[state]
        pub oracle_whitelist: Map<[u8; 32], bool>,
        
        /// UTXO commitment history (for cross-chain)
        #[state]
        pub utxo_commitments: StorageVec<[u8; 32]>,
    }
    
    #[contract(impl)]
    impl PoEzkBTCMinter {
        /// Initialize contract with admin and treasury
        #[constructor]
        pub fn new(admin: String, treasury: String) -> Self {
            Self {
                admin,
                certified_devices: Map::new(),
                device_energy_total: Map::new(),
                device_to_wallet: Map::new(),
                total_minted: 0,
                total_burned: 0,
                treasury,
                oracle_whitelist: Map::new(),
                utxo_commitments: StorageVec::new(),
            }
        }
        
        /// Certify a new energy device (DAO only)
        #[message]
        pub fn certify_device(
            &mut self,
            device_id: [u8; 32],
            prosumer_wallet: String,
        ) -> Result<(), String> {
            // Only admin (DAO) can certify devices
            self.ensure_admin()?;
            
            // Check device not already certified
            if self.certified_devices.contains_key(&device_id) {
                return Err("Device already certified".into());
            }
            
            // Register device
            self.certified_devices.insert(device_id, DeviceStatus::Certified);
            self.device_to_wallet.insert(device_id, prosumer_wallet);
            
            Ok(())
        }
        
        /// Mint zkBTC-E tokens with PoE proof
        #[message]
        pub fn mint_with_poe(
            &mut self,
            poe_packet: PoEPacket,
            zk_proof: ZkMintProof,
            utxo_proof: [u8; 32], // Merkle proof of consumer payment
        ) -> Result<u64, String> {
            // 1. Verify device is certified
            let status = self.certified_devices.get(&poe_packet.device_id)
                .ok_or("Device not certified")?;
            
            if status != DeviceStatus::Certified {
                return Err("Device not active".into());
            }
            
            // 2. Verify oracle is whitelisted
            if !self.oracle_whitelist.get(&poe_packet.oracle_id).unwrap_or(false) {
                return Err("Oracle not authorized".into());
            }
            
            // 3. Verify zk-SNARK proof
            self.verify_zk_proof(&zk_proof, &poe_packet)?;
            
            // 4. Verify UTXO payment proof
            self.verify_utxo_payment(utxo_proof)?;
            
            // 5. Calculate tokens to mint (1 MWh = 1 zkBTC-E)
            let tokens_to_mint = poe_packet.energy_wh / 1_000_000; // Convert Wh to MWh
            
            if tokens_to_mint == 0 {
                return Err("Insufficient energy for minting".into());
            }
            
            // 6. Update device energy total
            let current_total = self.device_energy_total
                .get(&poe_packet.device_id)
                .unwrap_or(0);
            self.device_energy_total.insert(
                poe_packet.device_id,
                current_total + poe_packet.energy_wh as u128
            );
            
            // 7. Apply distribution split (85/15)
            let prosumer_tokens = (tokens_to_mint * 85) / 100;
            let protocol_tokens = tokens_to_mint - prosumer_tokens;
            
            // 8. Get prosumer wallet
            let prosumer_wallet = self.device_to_wallet
                .get(&poe_packet.device_id)
                .ok_or("No wallet mapped to device")?;
            
            // 9. Mint tokens (simplified - in reality would call Charms minting)
            self.total_minted += tokens_to_mint;
            
            // 10. Emit events for frontend
            wasm::emit_event("PoEMinted", &(
                poe_packet.device_id,
                tokens_to_mint,
                prosumer_tokens,
                protocol_tokens,
            ));
            
            Ok(tokens_to_mint)
        }
        
        /// Burn zkBTC-E for backing assets
        #[message]
        pub fn burn_for_assets(
            &mut self,
            amount: u64,
            recipient_chain: String,
            recipient_address: String,
            burn_proof: ZkMintProof,
        ) -> Result<(), String> {
            // Verify burn proof
            self.verify_burn_proof(&burn_proof, amount)?;
            
            // Update burned total
            self.total_burned += amount;
            
            // Calculate asset value (1 zkBTC-E = $70 in backing)
            let usd_value = amount * 70;
            
            // Emit cross-chain bridge event
            wasm::emit_event("AssetsBridged", &(
                amount,
                usd_value,
                recipient_chain,
                recipient_address,
            ));
            
            Ok(())
        }
        
        /// Add oracle to whitelist (DAO only)
        #[message]
        pub fn add_oracle(&mut self, oracle_id: [u8; 32]) -> Result<(), String> {
            self.ensure_admin()?;
            self.oracle_whitelist.insert(oracle_id, true);
            Ok(())
        }
        
        // Internal helper functions
        fn ensure_admin(&self) -> Result<(), String> {
            let caller = wasm::caller();
            if caller != self.admin {
                return Err("Caller is not admin".into());
            }
            Ok(())
        }
        
        fn verify_zk_proof(&self, proof: &ZkMintProof, packet: &PoEPacket) -> Result<(), String> {
            // In production, this would verify the zk-SNARK proof
            // For now, we simulate verification
            
            // Check proof length
            if proof.proof.len() < 100 {
                return Err("Invalid proof length".into());
            }
            
            // Verify VK hash matches known circuit
            let expected_vk_hash = hex::decode("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
                .map_err(|_| "Invalid hex")?;
            
            if proof.vk_hash != expected_vk_hash.as_slice().try_into().unwrap() {
                return Err("Invalid verification key".into());
            }
            
            // Verify public inputs match packet data
            let energy_hash = sha256(&packet.energy_wh.to_be_bytes());
            if proof.public_inputs[0] != energy_hash {
                return Err("Proof doesn't match energy data".into());
            }
            
            Ok(())
        }
        
        fn verify_utxo_payment(&self, utxo_proof: [u8; 32]) -> Result<(), String> {
            // Verify UTXO payment exists and is confirmed
            // This would connect to BitcoinOS UTXO verifier contract
            
            // For now, just store commitment
            self.utxo_commitments.push(utxo_proof);
            
            Ok(())
        }
        
        fn verify_burn_proof(&self, proof: &ZkMintProof, amount: u64) -> Result<(), String> {
            // Similar to mint proof verification but for burn circuit
            if proof.proof.is_empty() {
                return Err("Empty burn proof".into());
            }
            
            // Check burn circuit VK hash
            let burn_vk_hash = hex::decode("fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321")
                .map_err(|_| "Invalid hex")?;
            
            if proof.vk_hash != burn_vk_hash.as_slice().try_into().unwrap() {
                return Err("Invalid burn verification key".into());
            }
            
            Ok(())
        }
    }
}
