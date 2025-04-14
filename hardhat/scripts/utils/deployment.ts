import fs from 'fs';
import path from 'path';

interface DeploymentInfo {
  network: string;
  timestamp: string;
  contracts: {
    [key: string]: {
      address: string;
      deployer: string;
      constructorArgs: any[];
    };
  };
}

export async function saveDeploymentInfo(info: DeploymentInfo): Promise<void> {
  const deploymentsDir = path.join(__dirname, '../../deployments');
  const networkDir = path.join(deploymentsDir, info.network);
  
  // Create directories if they don't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  if (!fs.existsSync(networkDir)) {
    fs.mkdirSync(networkDir);
  }
  
  // Save deployment info
  const filePath = path.join(networkDir, `${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(info, null, 2));
} 