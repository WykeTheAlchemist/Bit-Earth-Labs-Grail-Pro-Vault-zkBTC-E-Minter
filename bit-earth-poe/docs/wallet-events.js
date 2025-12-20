// Subscribe to balance changes
poeService.on('balanceChanged', (newBalance, oldBalance) => {
  console.log(`Balance changed: ${oldBalance} → ${newBalance}`);
});

// Subscribe to transaction events
poeService.on('transactionConfirmed', (tx) => {
  console.log(`Transaction confirmed: ${tx.id}`);
});

// Subscribe to mint events
poeService.on('zkbtcMinted', (amount, deviceId) => {
  console.log(`${amount} zkBTC-E minted for device ${deviceId}`);
});
