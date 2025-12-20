# Get API token
POST /auth/token
{
  "api_key": "your_api_key",
  "secret": "your_secret"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
