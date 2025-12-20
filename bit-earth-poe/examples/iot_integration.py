# Real IoT sensor data reader for smart meters
# This would run on Raspberry Pi/edge device

import time
import json
import hashlib
import requests
from datetime import datetime
import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

class SmartMeterReader:
    def __init__(self, meter_id, private_key, oracle_url):
        self.meter_id = meter_id
        self.private_key = private_key
        self.oracle_url = oracle_url
        
        # Initialize I2C and ADC for voltage/current sensors
        self.i2c = busio.I2C(board.SCL, board.SDA)
        self.ads = ADS.ADS1115(self.i2c)
        
        # Configure channels
        self.voltage_channel = AnalogIn(self.ads, ADS.P0)
        self.current_channel = AnalogIn(self.ads, ADS.P1)
        
        # Calibration factors
        self.voltage_calibration = 230.0 / 3.3  # 230V nominal
        self.current_calibration = 100.0 / 3.3   # 100A max
        
        # Energy tracking
        self.cumulative_energy_wh = 0
        self.last_reading_time = time.time()
        
    def read_sensors(self):
        """Read voltage and current from sensors"""
        voltage_raw = self.voltage_channel.value
        current_raw = self.current_channel.value
        
        # Convert to real values
        voltage = (voltage_raw * 3.3 / 32767) * self.voltage_calibration
        current = (current_raw * 3.3 / 32767) * self.current_calibration
        
        return voltage, current
    
    def calculate_power(self, voltage, current, power_factor=0.95):
        """Calculate real power"""
        apparent_power = voltage * current  # VA
        real_power = apparent_power * power_factor  # Watts
        return real_power
    
    def generate_poe_packet(self, energy_wh):
        """Create signed PoE data packet"""
        timestamp = int(time.time() * 1000)
        
        # Device ID hash
        device_id_hash = hashlib.sha256(self.meter_id.encode()).digest()
        
        # Create packet
        packet = {
            "device_id": device_id_hash.hex(),
            "timestamp": timestamp,
            "energy_wh": energy_wh,
            "cumulative_energy": self.cumulative_energy_wh,
            "meter_id": self.meter_id,
            "firmware_version": "1.0.0"
        }
        
        # Sign packet
        signature = self.sign_packet(packet)
        packet["signature"] = signature.hex()
        
        return packet
    
    def sign_packet(self, packet):
        """Sign packet with device private key"""
        # Using Ed25519 for signatures
        message = json.dumps(packet, sort_keys=True).encode()
        
        # In production: Use hardware secure element
        # For demo: simulate signature
        dummy_sig = hashlib.sha256(message + self.private_key).digest()
        return dummy_sig
    
    def send_to_oracle(self, packet):
        """Submit PoE packet to oracle network"""
        try:
            response = requests.post(
                f"{self.oracle_url}/submit-poe",
                json=packet,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"PoE packet submitted: {packet['energy_wh']} Wh")
                return True
            else:
                print(f"Failed to submit: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"Error submitting to oracle: {e}")
            return False
    
    def run(self):
        """Main sensor reading loop"""
        print(f"Starting Smart Meter Reader: {self.meter_id}")
        
        while True:
            try:
                # Read sensors
                voltage, current = self.read_sensors()
                
                # Calculate power and energy
                power_w = self.calculate_power(voltage, current)
                current_time = time.time()
                time_delta = current_time - self.last_reading_time
                
                # Energy in watt-hours
                energy_wh = (power_w * time_delta) / 3600
                
                if energy_wh > 0:
                    # Update cumulative energy
                    self.cumulative_energy_wh += energy_wh
                    
                    # Generate PoE packet
                    packet = self.generate_poe_packet(int(energy_wh))
                    
                    # Send to oracle
                    self.send_to_oracle(packet)
                
                self.last_reading_time = current_time
                
                # Log reading
                print(f"[{datetime.now()}] V: {voltage:.1f}V, I: {current:.2f}A, "
                      f"P: {power_w:.0f}W, E: {energy_wh:.2f}Wh")
                
                # Wait for next reading (e.g., every 5 minutes)
                time.sleep(300)
                
            except Exception as e:
                print(f"Error in sensor loop: {e}")
                time.sleep(60)

if __name__ == "__main__":
    # Configuration
    METER_ID = "solar_panel_001"
    PRIVATE_KEY = bytes.fromhex("your_private_key_here")
    ORACLE_URL = "https://oracle.bit-earth.org"
    
    # Start reader
    reader = SmartMeterReader(METER_ID, PRIVATE_KEY, ORACLE_URL)
    reader.run()
