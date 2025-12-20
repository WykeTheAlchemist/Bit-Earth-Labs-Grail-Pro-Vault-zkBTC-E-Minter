GET /api/v1/oracle/status/{device_id}
Authorization: Bearer {token}

Response:
{
  "device_id": "solar_farm_001",
  "last_verified": "2024-01-20T10:30:00Z",
  "total_verified_energy": 1250000,
  "uptime": 99.8,
  "next_verification": "2024-01-20T10:35:00Z"
}
