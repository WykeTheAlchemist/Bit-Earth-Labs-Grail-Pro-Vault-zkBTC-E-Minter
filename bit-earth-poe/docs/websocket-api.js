const ws = new WebSocket('wss://api.bit-earth.org/ws');

ws.onopen = () => {
  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['energy', 'transactions', 'mints']
  }));
  
  // Subscribe to specific device
  ws.send(JSON.stringify({
    type: 'subscribe_device',
    device_id: 'solar_001'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'energy_reading':
      console.log('New energy reading:', data);
      break;
    case 'transaction':
      console.log('New transaction:', data);
      break;
    case 'mint':
      console.log('zkBTC-E minted:', data);
      break;
  }
};
