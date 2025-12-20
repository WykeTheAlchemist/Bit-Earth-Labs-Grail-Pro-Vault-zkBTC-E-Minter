import 'package:bit_earth_sdk/bit_earth_sdk.dart';

class HomePage extends StatefulWidget {
  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  double _balance = 0;
  late PoESDK _sdk;
  
  @override
  void initState() {
    super.initState();
    _initSDK();
  }
  
  Future<void> _initSDK() async {
    _sdk = PoESDK();
    await _sdk.initialize(
      network: Network.testnet,
      config: SDKConfig(
        apiKey: 'your_api_key',
      ),
    );
    
    final wallet = await _sdk.connectWallet();
    final balance = await _sdk.getBalance();
    
    setState(() {
      _balance = balance;
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Balance: $_balance zkBTC-E'),
            ElevatedButton(
              onPressed: () => _sdk.burnTokens(1.5, 'bitcoin', 'address'),
              child: Text('Burn Tokens'),
            ),
          ],
        ),
      ),
    );
  }
}
