import Web3 from 'web3';
import PoEABI from './abi/PoEContract.json';

const web3 = new Web3('https://evm.bitcoinos.org');
const contract = new web3.eth.Contract(PoEABI, contractAddress);

// Read data
const balance = await contract.methods.balanceOf(walletAddress).call();
const totalSupply = await contract.methods.totalSupply().call();

// Write data
const tx = await contract.methods.burn(amount, recipient).send({
  from: walletAddress,
  gas: 200000
});
