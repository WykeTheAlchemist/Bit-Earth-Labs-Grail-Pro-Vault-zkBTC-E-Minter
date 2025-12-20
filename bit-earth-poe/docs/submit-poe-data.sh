POST /api/v1/oracle/submit-poe
Content-Type: application/json
X-API-Key: {oracle_api_key}

{
  "packet": {
    "device_id": "...",
    "timestamp": 1672531200000,
    "energy_wh": 1500,
    "signature": "..."
  },
  "verification_data": {
    "sensor_readings": [...],
    "weather_data": {...},
    "grid_status": "stable"
  }
}
