// Register device
const device = await poeService.registerDevice({
  deviceId: "solar_panel_001",
  type: "solar_inverter",
  manufacturer: "SolarEdge",
  model: "SE5000H",
  capacity: 5000, // Watts
  location: {
    latitude: 34.0522,
    longitude: -118.2437,
    address: "Los Angeles, CA"
  },
  prosumerWallet: "addr1q9...",
  metadata: {
    installation_date: "2024-01-15",
    maintenance_schedule: "quarterly",
    warranty_expiry: "2029-01-15"
  }
});
