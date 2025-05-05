console.log("\nCONTRACT VERIFICATION COMPLETE");

// Add controller setting functionality
console.log("\nSetting controller in vault...");
try {
  console.log(`Setting controller ${controllerAddress} in vault ${vaultAddress}...`);
  const setTx = await vault.setController(controllerAddress, {
    gasLimit: 200000,
    gasPrice: ethers.parseUnits("600", "gwei")
  });
  
  console.log(`Transaction sent: ${setTx.hash}`);
  console.log("Waiting for confirmation...");
  
  const setReceipt = await setTx.wait();
  console.log(`Transaction confirmed in block ${setReceipt.blockNumber}`);
  
  // Verify setting worked
  const updatedController = await vault.controller();
  console.log(`New controller address in vault: ${updatedController}`);
  
  if (updatedController.toLowerCase() === controllerAddress.toLowerCase()) {
    console.log("Controller successfully set! ✅");
  } else {
    console.error("Controller not set correctly ❌");
  }
} catch (error) {
  console.error("Error setting controller:", error);
}

console.log("\nSETUP COMPLETE");

} catch (error) {
  // ... existing code ...
} 