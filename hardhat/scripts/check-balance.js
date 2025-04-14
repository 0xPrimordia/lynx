const { ethers } = require('hardhat');

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking balance for:", signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log();
}
