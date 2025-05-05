// Load deployment info
let deploymentInfo: any = {};
try {
  deploymentInfo = JSON.parse(fs.readFileSync("../deployment-info.json", "utf8"));
  console.log("Loaded deployment info");
} catch (error) {
  console.error("Error loading deployment info. Using placeholder addresses.");
  
  // Placeholders - you'll need real addresses
  deploymentInfo = {
    vaultEvm: "0xFE4af8e846408A64E581479a32EAd589E2C350fd",
    controllerEvm: "0x48De035EeEffdec80429aF864937039237379E64",
    tokenAddress: "0x0000000000000000000000000000000000000000"
  };
}

console.log("Vault address:", deploymentInfo.vaultEvm);
console.log("Controller address:", deploymentInfo.controllerEvm);
console.log("Index token address:", deploymentInfo.tokenAddress);

// Connect to contracts
const IndexVault = await hre.ethers.getContractFactory("IndexVault");
const vault = await IndexVault.attach(deploymentInfo.vaultEvm);

const IndexTokenController = await hre.ethers.getContractFactory("IndexTokenController");
const controller = await IndexTokenController.attach(deploymentInfo.controllerEvm); 