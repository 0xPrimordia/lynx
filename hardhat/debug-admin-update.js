// Debug script for adminUpdateRatios function
const { ethers } = require('hardhat');

async function debugAdminUpdate() {
    console.log('🔍 Debugging adminUpdateRatios function...\n');
    
    // Get the contract (you'll need to update the address)
    const contractAddress = "YOUR_CONTRACT_ADDRESS"; // Update this!
    const contract = await ethers.getContractAt("DepositMinterV2", contractAddress);
    
    try {
        // 1. Check current state
        console.log('1️⃣ Checking contract state...');
        const admin = await contract.ADMIN();
        const currentRatios = await contract.getCurrentRatios();
        
        console.log('Admin:', admin);
        console.log('Current ratios:', {
            HBAR: currentRatios.hbarRatio.toString(),
            WBTC: currentRatios.wbtcRatio.toString(), 
            SAUCE: currentRatios.sauceRatio.toString(),
            USDC: currentRatios.usdcRatio.toString(),
            JAM: currentRatios.jamRatio.toString(),
            HEADSTART: currentRatios.headstartRatio.toString()
        });
        
        // 2. Check caller
        const [signer] = await ethers.getSigners();
        console.log('\nYour address:', signer.address);
        console.log('Are you admin?', admin.toLowerCase() === signer.address.toLowerCase());
        
        // 3. Test with current ratios (should be safe)
        console.log('\n2️⃣ Testing with current ratios (no-op)...');
        const tx = await contract.adminUpdateRatios(
            currentRatios.hbarRatio,
            currentRatios.wbtcRatio,
            currentRatios.sauceRatio, 
            currentRatios.usdcRatio,
            currentRatios.jamRatio,
            currentRatios.headstartRatio
        );
        
        console.log('Transaction submitted:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Success! Transaction confirmed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // Try to decode the error
        if (error.data) {
            console.log('Error data:', error.data);
            const decoded = Buffer.from(error.data.slice(2), 'hex').toString('ascii');
            console.log('ASCII decoded:', decoded);
        }
    }
}

debugAdminUpdate().catch(console.error);
