# Submit sensor data
POST /api/v1/iot/submit
Content-Type: application/json
Authorization: Bearer {device_token}

{
  "device_id": "your_device_id",
  "data": {...}
}
