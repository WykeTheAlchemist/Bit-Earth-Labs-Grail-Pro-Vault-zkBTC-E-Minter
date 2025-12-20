from bit_earth_sdk import PoEClient

client = PoEClient(
    network="testnet",
    api_key="your_api_key"
)

# Connect using seed phrase
wallet = client.connect_wallet(
    mnemonic="your mnemonic phrase",
    wallet_type="bitcoinos"
)

# Get address
address = wallet.get_address()
print(f"Address: {address}")

# Sign message
signature = wallet.sign_message("Hello Bit-Earth")
