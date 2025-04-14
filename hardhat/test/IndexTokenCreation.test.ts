import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

// Mock for the Hedera Token Service
const mockHtsAbi = [
  "function createToken(tuple(string name, string symbol, address treasury, string memo, bool supplyType, uint32 maxSupply, bool freezeDefault, address[] freezeKey, address[] wipeKey, address[] supplyKey, address[] adminKey, address[] kycKey, uint8 decimals, address autoRenewAccount, uint32 autoRenewPeriod) token, uint initialTotalSupply, uint8[] keys, address[] keyAddresses) external payable returns (int64 responseCode, address tokenAddress)",
  "function associateToken(address account, address token) external returns (int64)",
  "function isSupplyKey(address token, address supplyAddress) external view returns (bool)"
];

describe("IndexTokenCreation", function() {
  let mockHts: Contract;
  let vault: Contract;
  let controller: Contract;
  let owner: any;
  let user: any;
  
  beforeEach(async function() {
    // Get signers
    [owner, user] = await ethers.getSigners();
    
    // Deploy mock HTS
    mockHts = await ethers.deployContract("MockHederaTokenService");
    
    // Deploy vault
    const IndexVault = await ethers.getContractFactory("IndexVault");
    vault = await IndexVault.deploy(ethers.ZeroAddress, mockHts.target);
    
    // Deploy controller
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    controller = await IndexTokenController.deploy(vault.target, mockHts.target);
    
    // Set controller in vault
    await vault.connect(owner).setController(controller.target);
  });
  
  it("Should create a token successfully", async function() {
    // Token parameters
    const name = "Lynx Test Token";
    const symbol = "LYNX";
    const memo = "Test token";
    
    // Create token
    const tx = await controller.createIndexToken(name, symbol, memo, {
      value: ethers.parseEther("10.0")
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    // Check events were emitted
    const tokenCreationAttemptEvent = receipt.logs.find(
      (log: any) => log.fragment?.name === "TokenCreationAttempt"
    );
    
    expect(tokenCreationAttemptEvent).to.not.be.undefined;
    
    // Check token address was set
    const tokenAddress = await controller.INDEX_TOKEN();
    expect(tokenAddress).to.not.equal(ethers.ZeroAddress);
    
    // Check supply key status
    const hasSupplyKey = await controller.hasSupplyKey();
    expect(hasSupplyKey).to.be.true;
  });
}); 