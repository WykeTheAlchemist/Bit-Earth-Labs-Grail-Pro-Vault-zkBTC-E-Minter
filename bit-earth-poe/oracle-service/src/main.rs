//! Oracle service for IoT data verification
//! Connects to smart meters and validates PoE data

use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use web3::types::H256;
use ed25519_dalek::{Keypair, Signer};

#[derive(Debug, Serialize, Deserialize)]
pub struct IoTData {
    pub meter_id: String,
    pub timestamp: u64,
    pub voltage: f64,
    pub current: f64,
    pub power_factor: f64,
    pub cumulative_kwh: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifiedPoE {
    pub packet: Vec<u8>,
    pub signature: [u8; 64],
    pub oracle_id: [u8; 32],
    pub block_number: u64,
}

pub struct OracleService {
    keypair: Keypair,
    rpc_url: String,
    verified_data: Arc<Mutex<Vec<VerifiedPoE>>>,
}

impl OracleService {
    pub fn new(private_key: [u8; 32], rpc_url: String) -> Self {
        let keypair = Keypair::from_bytes(&private_key).expect("Invalid private key");
        
        Self {
            keypair,
            rpc_url,
            verified_data: Arc::new(Mutex::new(Vec::new())),
        }
    }
    
    /// Listen to IoT data stream from smart meters
    pub async fn listen_to_iot_stream(&self, meter_ids: Vec<String>) {
        // In production: Connect to MQTT/WebSocket stream from smart meters
        
        // Simulated data ingestion
        tokio::spawn(async move {
            loop {
                // Receive IoT data (this would be from actual IoT devices)
                let simulated_data = IoTData {
                    meter_id: "meter_001".to_string(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                    voltage: 230.0,
                    current: 10.0,
                    power_factor: 0.95,
                    cumulative_kwh: 1500.5,
                };
                
                // Verify and sign data
                self.process_iot_data(simulated_data).await;
                
                tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            }
        });
    }
    
    async fn process_iot_data(&self, data: IoTData) {
        // Calculate energy generated since last reading
        let energy_wh = (data.voltage * data.current * data.power_factor * 1.0) as u64;
        
        // Create PoE packet
        let poe_packet = serde_json::json!({
            "device_id": self.hash_meter_id(&data.meter_id),
            "timestamp": data.timestamp,
            "energy_wh": energy_wh,
            "cumulative_energy": (data.cumulative_kwh * 1000.0) as u128,
        });
        
        // Sign the packet
        let message = serde_json::to_vec(&poe_packet).unwrap();
        let signature = self.keypair.sign(&message).to_bytes();
        
        // Create verified PoE
        let verified_poe = VerifiedPoE {
            packet: message,
            signature,
            oracle_id: self.keypair.public.to_bytes(),
            block_number: 0, // Will be set when submitted
        };
        
        // Store locally
        let mut verified = self.verified_data.lock().await;
        verified.push(verified_poe);
        
        // Submit to blockchain via Charms SDK
        self.submit_to_blockchain(&verified).await;
    }
    
    fn hash_meter_id(&self, meter_id: &str) -> [u8; 32] {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(meter_id.as_bytes());
        let result = hasher.finalize();
        result.into()
    }
    
    async fn submit_to_blockchain(&self, verified_poe: &VerifiedPoE) {
        // Use Charms SDK to submit to BitcoinOS
        // This would trigger the minting spell
        
        println!("Submitting verified PoE to blockchain: {:?}", verified_poe);
        
        // In production: Call Charms API or smart contract
    }
}
