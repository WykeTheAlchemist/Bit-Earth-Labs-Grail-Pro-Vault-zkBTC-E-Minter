#!/usr/bin/env python3
"""
Bit-Earth IoT Sensor Reader
File: hardware/iot-integration/python/iot_sensor_reader.py
Description: Real IoT sensor data collection for smart meters
"""

import time
import json
import hashlib
import logging
import argparse
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import requests
from dataclasses import dataclass, asdict
import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class SensorReading:
    """Data class for sensor readings"""
    timestamp: int
    voltage: float  # Volts
    current: float  # Amps
    power_factor: float
    frequency: float  # Hz
    temperature: float  # Celsius
    humidity: float  # Percentage

@dataclass
class PoEPacket:
    """Proof-of-Energy data packet"""
    device_id: str
    timestamp: int
    energy_wh: int
    cumulative_energy: int
    sensor_readings: list
    firmware_version: str = "1.0.0"
    protocol_version: str = "poe-v1"

class SmartMeterReader:
    """Main class for reading smart meter data"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize smart meter reader
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.meter_id = config['meter_id']
        self.oracle_url = config['oracle_url']
        self.private_key = bytes.fromhex(config['private_key'])
        
        # Energy tracking
        self.cumulative_energy_wh = 0
        self.last_reading_time = time.time()
        self.reading_interval = config.get('reading_interval', 300)  # 5 minutes
        
        # Initialize sensors
        self.initialize_sensors()
        
        # Statistics
        self.readings_sent = 0
        self.readings_failed = 0
        
        logger.info(f"Initialized Smart Meter Reader for {self.meter_id}")
    
    def initialize_sensors(self) -> None:
        """Initialize I2C sensors"""
        try:
            # Initialize I2C bus
            self.i2c = busio.I2C(board.SCL, board.SDA)
            
            # Initialize ADS1115 ADC (16-bit)
            self.ads = ADS.ADS1115(self.i2c)
            
            # Configure channels
            # Channel 0: Voltage measurement (230V AC through voltage divider)
            # Channel 1: Current measurement (CT sensor output)
            # Channel 2: Temperature (optional)
            # Channel 3: Humidity (optional)
            
            self.voltage_channel = AnalogIn(self.ads, ADS.P0)
            self.current_channel = AnalogIn(self.ads, ADS.P1)
            
            # Calibration factors (should be calibrated for each device)
            self.voltage_calibration = self.config.get('voltage_calibration', 230.0 / 3.3)
            self.current_calibration = self.config.get('current_calibration', 100.0 / 3.3)
            self.power_factor = self.config.get('default_power_factor', 0.95)
            self.frequency = self.config.get('grid_frequency', 50.0)  # 50Hz or 60Hz
            
            logger.info("Sensors initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize sensors: {e}")
            raise
    
    def read_sensors(self) -> SensorReading:
        """
        Read all sensors
        
        Returns:
            SensorReading object with all measurements
        """
        try:
            # Read raw ADC values
            voltage_raw = self.voltage_channel.value
            current_raw = self.current_channel.value
            
            # Convert to actual values
            # Note: For AC measurements, we would use RMS calculations
            # This is a simplified version for demonstration
            
            # Convert ADC reading to voltage (ADS1115 is 16-bit, 3.3V reference)
            voltage_adc = (voltage_raw * 3.3) / 32767.0
            current_adc = (current_raw * 3.3) / 32767.0
            
            # Apply calibration factors
            voltage = voltage_adc * self.voltage_calibration
            current = current_adc * self.current_calibration
            
            # For demo, simulate temperature and humidity
            temperature = 25.0 + (time.time() % 10)  # Simulate variation
            humidity = 45.0 + (time.time() % 20)     # Simulate variation
            
            reading = SensorReading(
                timestamp=int(time.time() * 1000),
                voltage=round(voltage, 2),
                current=round(current, 2),
                power_factor=self.power_factor,
                frequency=self.frequency,
                temperature=round(temperature, 1),
                humidity=round(humidity, 1)
            )
            
            logger.debug(f"Sensor reading: {reading}")
            return reading
            
        except Exception as e:
            logger.error(f"Error reading sensors: {e}")
            # Return default values on error
            return SensorReading(
                timestamp=int(time.time() * 1000),
                voltage=0.0,
                current=0.0,
                power_factor=0.0,
                frequency=0.0,
                temperature=0.0,
                humidity=0.0
            )
    
    def calculate_energy(self, reading: SensorReading, time_delta: float) -> float:
        """
        Calculate energy generated/consumed
        
        Args:
            reading: Sensor reading
            time_delta: Time since last reading in seconds
            
        Returns:
            Energy in watt-hours
        """
        # Calculate apparent power (VA)
        apparent_power = reading.voltage * reading.current
        
        # Calculate real power (W)
        real_power = apparent_power * reading.power_factor
        
        # Calculate energy (Wh) = power (W) * time (hours)
        energy_wh = (real_power * time_delta) / 3600.0
        
        return max(0.0, energy_wh)  # Ensure non-negative
    
    def generate_device_id(self) -> str:
        """Generate device ID hash"""
        # Combine meter ID with manufacturer info
        device_info = f"{self.meter_id}:{self.config.get('manufacturer', 'unknown')}:{self.config.get('serial_number', '0000')}"
        return hashlib.sha256(device_info.encode()).hexdigest()
    
    def sign_packet(self, packet: Dict[str, Any]) -> str:
        """
        Sign PoE packet with device private key
        
        Args:
            packet: PoE packet data
            
        Returns:
            Hexadecimal signature
        """
        # Create canonical JSON string
        canonical_json = json.dumps(packet, sort_keys=True, separators=(',', ':'))
        
        # Hash the JSON
        message_hash = hashlib.sha256(canonical_json.encode()).digest()
        
        # In production: Use Ed25519 or ECDSA with hardware secure element
        # For demo: Create a simulated signature
        simulated_sig = hashlib.sha256(message_hash + self.private_key).hexdigest()
        
        return simulated_sig
    
    def create_poe_packet(self, energy_wh: float, readings: list) -> Dict[str, Any]:
        """
        Create Proof-of-Energy packet
        
        Args:
            energy_wh: Energy generated in watt-hours
            readings: List of sensor readings
            
        Returns:
            PoE packet as dictionary
        """
        packet = PoEPacket(
            device_id=self.generate_device_id(),
            timestamp=int(time.time() * 1000),
            energy_wh=int(energy_wh),
            cumulative_energy=int(self.cumulative_energy_wh),
            sensor_readings=[asdict(r) for r in readings],
        )
        
        packet_dict = asdict(packet)
        
        # Add signature
        packet_dict['signature'] = self.sign_packet(packet_dict)
        packet_dict['meter_id'] = self.meter_id
        
        return packet_dict
    
    def send_to_oracle(self, packet: Dict[str, Any]) -> bool:
        """
        Send PoE packet to oracle service
        
        Args:
            packet: PoE packet
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Sending PoE packet: {packet['energy_wh']} Wh")
            
            response = requests.post(
                f"{self.oracle_url}/submit-poe",
                json=packet,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                self.readings_sent += 1
                logger.info(f"Packet submitted successfully (Total: {self.readings_sent})")
                return True
            else:
                self.readings_failed += 1
                logger.error(f"Failed to submit packet: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.readings_failed += 1
            logger.error(f"Network error submitting to oracle: {e}")
            return False
        except Exception as e:
            self.readings_failed += 1
            logger.error(f"Unexpected error: {e}")
            return False
    
    def run_diagnostic(self) -> Dict[str, Any]:
        """Run system diagnostic"""
        readings = []
        for i in range(5):  # Take 5 quick readings
            reading = self.read_sensors()
            readings.append(reading)
            time.sleep(0.1)
        
        avg_voltage = sum(r.voltage for r in readings) / len(readings)
        avg_current = sum(r.current for r in readings) / len(readings)
        
        return {
            'meter_id': self.meter_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'voltage_avg': round(avg_voltage, 2),
            'current_avg': round(avg_current, 2),
            'sensor_status': 'OK' if avg_voltage > 0 else 'ERROR',
            'readings_taken': len(readings),
            'cumulative_energy_wh': self.cumulative_energy_wh,
        }
    
    def run(self) -> None:
        """Main sensor reading loop"""
        logger.info(f"Starting Smart Meter Reader: {self.meter_id}")
        logger.info(f"Reading interval: {self.reading_interval} seconds")
        logger.info(f"Oracle endpoint: {self.oracle_url}")
        
        # Run diagnostic
        diagnostic = self.run_diagnostic()
        logger.info(f"Diagnostic: {json.dumps(diagnostic, indent=2)}")
        
        # Buffer for sensor readings (store last N readings)
        reading_buffer = []
        buffer_size = 6  # Keep last 30 minutes of readings (if 5-min interval)
        
        while True:
            cycle_start = time.time()
            
            try:
                # Read sensors
                reading = self.read_sensors()
                reading_buffer.append(reading)
                
                # Keep buffer at fixed size
                if len(reading_buffer) > buffer_size:
                    reading_buffer.pop(0)
                
                # Calculate time since last reading
                current_time = time.time()
                time_delta = current_time - self.last_reading_time
                
                # Calculate energy generated
                energy_wh = self.calculate_energy(reading, time_delta)
                
                if energy_wh > 0:
                    # Update cumulative energy
                    self.cumulative_energy_wh += energy_wh
                    
                    # Create PoE packet with recent readings
                    poe_packet = self.create_poe_packet(energy_wh, reading_buffer)
                    
                    # Send to oracle
                    self.send_to_oracle(poe_packet)
                
                # Update last reading time
                self.last_reading_time = current_time
                
                # Log current status
                logger.info(
                    f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
                    f"V: {reading.voltage:.1f}V, I: {reading.current:.2f}A, "
                    f"E: {energy_wh:.2f}Wh, Total: {self.cumulative_energy_wh:.0f}Wh"
                )
                
                # Calculate sleep time to maintain interval
                cycle_time = time.time() - cycle_start
                sleep_time = max(0, self.reading_interval - cycle_time)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                else:
                    logger.warning(f"Cycle took longer than interval: {cycle_time:.1f}s")
                    
            except KeyboardInterrupt:
                logger.info("Shutdown requested by user")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(60)  # Wait before retrying
        
        # Print statistics
        logger.info(f"Session complete. Readings sent: {self.readings_sent}, Failed: {self.readings_failed}")

def load_config(config_file: str) -> Dict[str, Any]:
    """Load configuration from JSON file"""
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        # Validate required fields
        required_fields = ['meter_id', 'oracle_url', 'private_key']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field: {field}")
        
        return config
    except FileNotFoundError:
        logger.error(f"Config file not found: {config_file}")
        raise
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in config file: {config_file}")
        raise

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Bit-Earth Smart Meter Reader')
    parser.add_argument('--config', type=str, required=True,
                       help='Path to configuration JSON file')
    parser.add_argument('--diagnostic', action='store_true',
                       help='Run diagnostic only')
    parser.add_argument('--interval', type=int,
                       help='Override reading interval in seconds')
    
    args = parser.parse_args()
    
    try:
        # Load configuration
        config = load_config(args.config)
        
        # Override interval if specified
        if args.interval:
            config['reading_interval'] = args.interval
        
        # Create reader
        reader = SmartMeterReader(config)
        
        if args.diagnostic:
            # Run diagnostic and exit
            diagnostic = reader.run_diagnostic()
            print(json.dumps(diagnostic, indent=2))
        else:
            # Run main loop
            reader.run()
            
    except KeyboardInterrupt:
        logger.info("Application stopped by user")
    except Exception as e:
        logger.error(f"Application failed: {e}")
        raise

if __name__ == "__main__":
    main()
