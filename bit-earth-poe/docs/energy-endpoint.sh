# Get device energy data
GET /energy/device/{device_id}
GET /energy/device/{device_id}/history?from=2024-01-01&to=2024-01-31

# Submit energy reading
POST /energy/reading
{
  "device_id": "solar_001",
  "timestamp": "2024-01-20T10:30:00Z",
  "energy_wh": 1500,
  "readings": [...]
}

# Get minting history
GET /energy/mints?device_id={device_id}&limit=100
