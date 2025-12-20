import React from 'react';
import { PoEMobileSDK } from '@bit-earth/mobile-sdk';

const App = () => {
  const [balance, setBalance] = React.useState(0);
  
  const initializeSDK = async () => {
    await PoEMobileSDK.initialize({
      network: 'testnet',
      walletType: 'mobile',
    });
    
    // Connect wallet
    const wallet = await PoEMobileSDK.connectWallet();
    
    // Get balance
    const currentBalance = await PoEMobileSDK.getBalance();
    setBalance(currentBalance);
    
    // Listen for events
    PoEMobileSDK.on('balanceChanged', setBalance);
  };
  
  return (
    <View>
      <Text>Balance: {balance} zkBTC-E</Text>
      <Button 
        title="Burn Tokens" 
        onPress={() => PoEMobileSDK.burnTokens(1, 'bitcoin', 'address')} 
      />
    </View>
  );
};
