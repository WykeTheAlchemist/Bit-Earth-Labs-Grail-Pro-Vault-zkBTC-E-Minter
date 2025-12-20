# Get token balance
GET /tokens/balance/{wallet_address}

# Get token transactions
GET /tokens/transactions/{wallet_address}

# Initiate burn
POST /tokens/burn
{
  "amount": 1.5,
  "target_chain": "bitcoin",
  "target_address": "tb1q...",
  "signature": "..."
}
