# Register webhook
POST /webhooks
{
  "url": "https://your-server.com/webhook",
  "events": [
    "energy_verified",
    "zkbtc_minted",
    "token_burned",
    "payment_received"
  ],
  "secret": "your_webhook_secret"
}

# Webhook payload example
POST https://your-server.com/webhook
X-BitEarth-Signature: sha256=...
{
  "event": "zkbtc_minted",
  "timestamp": "2024-01-20T10:30:00Z",
  "data": {
    "device_id": "solar_001",
    "amount": 1.5,
    "prosumer_wallet": "addr1q9...",
    "transaction_hash": "0x..."
  }
}
