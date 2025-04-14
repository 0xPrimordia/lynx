import { ethers } from 'ethers';
import { getDeploymentInfo, saveDeploymentInfo } from './utils/deployment';

async function main() {
  // Load environment variables
  require('dotenv').config();

  // Initialize provider and signer
  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // Get deployment info
  const deploymentInfo = await getDeploymentInfo();
  console.log('Deployment Info:', deploymentInfo);

  // Convert Hedera controller ID to EVM address
  const controllerAddress = ethers.getAddress(
    '0x' + deploymentInfo.controllerId.replace('.', '')
  );

  // Check if we already have a token address
  if (deploymentInfo.tokenAddress !== ethers.ZeroAddress) {
    console.log('Token already exists at:', deploymentInfo.tokenAddress);
    return;
  }

  // Get the controller contract
  const controller = new ethers.Contract(
    controllerAddress,
    [
      'function createIndexToken(string memory name, string memory symbol, string memory memo) external returns (address)',
      'function getTokenAddress() external view returns (address)'
    ],
    signer
  );

  // Token parameters
  const name = 'Lynx Index Token';
  const symbol = 'LYNX';
  const memo = 'Lynx Index Token';

  // Create the token
  console.log('Creating token...');
  const tx = await controller.createIndexToken(name, symbol, memo, {
    gasLimit: 1000000,
    gasPrice: ethers.parseUnits('50', 'gwei'),
    value: ethers.parseEther('1.0') // 1 HBAR for token creation fee
  });

  console.log('Transaction hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Transaction confirmed in block:', receipt.blockNumber);

  // Get the token address from the event
  const event = receipt.events?.find(e => e.event === 'TokenCreated');
  if (!event) {
    throw new Error('TokenCreated event not found');
  }

  const tokenAddress = event.args?.token;
  console.log('Token created at:', tokenAddress);

  // Update deployment info
  await saveDeploymentInfo({
    ...deploymentInfo,
    tokenAddress
  });

  console.log('Deployment info updated');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {}; 