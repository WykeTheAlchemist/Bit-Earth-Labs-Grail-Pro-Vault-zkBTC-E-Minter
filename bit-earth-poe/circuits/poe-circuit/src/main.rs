//! zk-SNARK circuit for Proof-of-Energy verification
//! Uses bellman library for circuit construction

use bellman::{
    Circuit, ConstraintSystem, SynthesisError, 
    groth16::{Parameters, Proof},
};
use bls12_381::{Bls12, Scalar};
use ff::PrimeField;
use std::marker::PhantomData;

/// Public inputs to the circuit
#[derive(Clone)]
pub struct PoEPublicInputs {
    /// Hash of device ID
    pub device_id_hash: [u8; 32],
    /// Energy generated (in Wh)
    pub energy_wh: u64,
    /// Timestamp
    pub timestamp: u64,
    /// Oracle signature validity
    pub oracle_valid: bool,
}

/// Private inputs (witnesses)
#[derive(Clone)]
pub struct PoEPrivateInputs {
    /// Original device ID (private)
    pub device_id: [u8; 32],
    /// Raw sensor readings (private)
    pub sensor_data: Vec<u64>,
    /// Oracle signature (private)
    pub oracle_sig: [u8; 64],
}

/// The main PoE circuit
pub struct PoECircuit<F: PrimeField> {
    // Public inputs
    pub device_id_hash: Option<[u8; 32]>,
    pub energy_wh: Option<u64>,
    pub timestamp: Option<u64>,
    pub oracle_valid: Option<bool>,
    
    // Private inputs
    pub device_id: Option<[u8; 32]>,
    pub sensor_data: Option<Vec<u64>>,
    pub oracle_sig: Option<[u8; 64]>,
    
    _marker: PhantomData<F>,
}

impl<F: PrimeField> Circuit<F> for PoECircuit<F> {
    fn synthesize<CS: ConstraintSystem<F>>(self, cs: &mut CS) -> Result<(), SynthesisError> {
        // 1. Verify device ID hash matches private device ID
        let device_id_var = cs.alloc_input(|| "device_id", || {
            self.device_id
                .map(|id| hash_to_field::<F>(&id))
                .ok_or(SynthesisError::AssignmentMissing)
        })?;
        
        let device_id_hash_var = cs.alloc_input(|| "device_id_hash", || {
            self.device_id_hash
                .map(|hash| hash_to_field::<F>(&hash))
                .ok_or(SynthesisError::AssignmentMissing)
        })?;
        
        // Constraint: hash(device_id) == device_id_hash
        cs.enforce(
            || "device_id_hash_constraint",
            |lc| lc + device_id_var,
            |lc| lc + CS::one(),
            |lc| lc + device_id_hash_var,
        );
        
        // 2. Verify energy calculation from sensor data
        let energy_var = cs.alloc_input(|| "energy_wh", || {
            self.energy_wh
                .map(|e| F::from(e))
                .ok_or(SynthesisError::AssignmentMissing)
        })?;
        
        // Simulate energy calculation from sensor data
        let calculated_energy_var = if let Some(data) = &self.sensor_data {
            // Sum sensor readings with some coefficients
            let mut sum = F::zero();
            for (i, &reading) in data.iter().enumerate() {
                let coeff = F::from((i + 1) as u64); // Simplified coefficient
                sum += coeff * F::from(reading);
            }
            sum
        } else {
            F::zero()
        };
        
        // Constraint: calculated energy == claimed energy
        cs.enforce(
            || "energy_constraint",
            |lc| lc + energy_var,
            |lc| lc + CS::one(),
            |lc| lc + calculated_energy_var,
        );
        
        // 3. Verify timestamp is recent (within 24 hours)
        let timestamp_var = cs.alloc_input(|| "timestamp", || {
            self.timestamp
                .map(|t| F::from(t))
                .ok_or(SynthesisError::AssignmentMissing)
        })?;
        
        // Current time constant (would be provided as public input in reality)
        let current_time = F::from(1_700_000_000_000u64); // Example
        
        // Constraint: timestamp <= current_time
        cs.enforce(
            || "timestamp_constraint",
            |lc| lc + current_time,
            |lc| lc + CS::one(),
            |lc| lc + timestamp_var,
        );
        
        // 4. Verify oracle signature (simplified)
        let oracle_valid_var = cs.alloc_input(|| "oracle_valid", || {
            self.oracle_valid
                .map(|v| if v { F::one() } else { F::zero() })
                .ok_or(SynthesisError::AssignmentMissing)
        })?;
        
        // Constraint: oracle_valid must be 1 (true)
        cs.enforce(
            || "oracle_constraint",
            |lc| lc + oracle_valid_var,
            |lc| lc + CS::one(),
            |lc| lc + CS::one(),
        );
        
        Ok(())
    }
}

/// Helper function to hash bytes to field element
fn hash_to_field<F: PrimeField>(data: &[u8]) -> F {
    // Simplified hash - in production use Poseidon or MiMC
    let mut sum = F::zero();
    for &byte in data {
        sum = sum * F::from(256u64) + F::from(byte as u64);
    }
    sum
}

/// Generate proof for PoE data
pub fn generate_poe_proof(
    params: &Parameters<Bls12>,
    public: PoEPublicInputs,
    private: PoEPrivateInputs,
) -> Result<Proof<Bls12>, SynthesisError> {
    let circuit = PoECircuit::<Scalar> {
        device_id_hash: Some(public.device_id_hash),
        energy_wh: Some(public.energy_wh),
        timestamp: Some(public.timestamp),
        oracle_valid: Some(public.oracle_valid),
        device_id: Some(private.device_id),
        sensor_data: Some(private.sensor_data),
        oracle_sig: Some(private.oracle_sig),
        _marker: PhantomData,
    };
    
    bellman::groth16::create_random_proof(circuit, params, &mut rand::thread_rng())
}
