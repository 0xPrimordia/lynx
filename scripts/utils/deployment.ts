import fs from 'fs';
import path from 'path';

interface DeploymentInfo {
    vaultId: string;
    controllerId: string;
    tokenAddress: string;
}

export function getDeploymentInfo(): DeploymentInfo {
    const deploymentInfoPath = path.join(__dirname, '../../deployment-info.json');
    if (!fs.existsSync(deploymentInfoPath)) {
        throw new Error('Deployment info file not found');
    }
    return JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf-8'));
}

export function saveDeploymentInfo(info: DeploymentInfo): void {
    const deploymentInfoPath = path.join(__dirname, '../../deployment-info.json');
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
} 