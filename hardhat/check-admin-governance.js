// Check admin vs governance account differences
const { ethers } = require('hardhat');

async function checkAccounts() {
    const contractAddress = "YOUR_CONTRACT_ADDRESS"; // Update this!
    const contract = await ethers.getContractAt("DepositMinterV2", contractAddress);
    
    console.log('🔍 Checking Admin vs Governance Setup...\n');
    
    // Get contract state
    const admin = await contract.ADMIN();
    const governance = await contract.GOVERNANCE();
    
    console.log('Admin Address:', admin);
    console.log('Governance Address:', governance);
    console.log('Governance Set?', governance !== ethers.constants.AddressZero);
    
    // Check current caller
    const [signer] = await ethers.getSigners();
    console.log('\nYour Address:', signer.address);
    console.log('Are you Admin?', admin.toLowerCase() === signer.address.toLowerCase());
    console.log('Are you Governance?', governance.toLowerCase() === signer.address.toLowerCase());
    
    // Test basic contract calls
    try {
        const ratios = await contract.getCurrentRatios();
        console.log('\n✅ Contract is accessible');
        console.log('Current ratios readable:', !!ratios);
    } catch (error) {
        console.log('\n❌ Contract access issue:', error.message);
    }
}

checkAccounts().catch(console.error);
