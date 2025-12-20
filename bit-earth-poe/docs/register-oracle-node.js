const oracleNode = await poeService.registerOracle({
  name: "California-Oracle-01",
  location: "San Francisco, CA",
  stakingAmount: 1000, // zkBTC-E tokens
  apiEndpoint: "https://oracle.example.com",
  capabilities: ["energy_verification", "weather_data", "grid_monitoring"]
});
