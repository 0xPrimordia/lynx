import fs from 'fs';
import path from 'path';

interface DeploymentRegistry {
  network: string;
  deployments: {
    contracts: Record<string, ContractDeployment>;
    tokens: Record<string, TokenDeployment>;
  };
  lastUpdated: string | null;
}

interface ContractDeployment {
  hederaId: string | null;
  evmAddress: string | null;
  deployedAt: string | null;
  verified: boolean;
  abi: string;
}

interface TokenDeployment {
  tokenId: string | null;
  createdAt: string | null;
  verified: boolean;
  decimals: number;
  controller?: string | null;
  type?: string;
}

export class DeploymentManager {
  private registryPath: string;
  private registry!: DeploymentRegistry;

  constructor(registryPath: string = './deployment-registry.json') {
    this.registryPath = registryPath;
    this.loadRegistry();
  }

  private loadRegistry(): void {
    try {
      const data = fs.readFileSync(this.registryPath, 'utf8');
      this.registry = JSON.parse(data);
    } catch (error) {
      console.error('Failed to load deployment registry:', error);
      throw error;
    }
  }

  private saveRegistry(): void {
    this.registry.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    console.log('✅ Deployment registry updated');
  }

  public recordContractDeployment(
    contractName: string,
    hederaId: string,
    evmAddress: string
  ): void {
    if (!this.registry.deployments.contracts[contractName]) {
      throw new Error(`Contract ${contractName} not found in registry`);
    }

    this.registry.deployments.contracts[contractName] = {
      ...this.registry.deployments.contracts[contractName],
      hederaId,
      evmAddress,
      deployedAt: new Date().toISOString(),
      verified: false
    };

    this.saveRegistry();
    console.log(`📝 Recorded deployment: ${contractName} = ${hederaId} (${evmAddress})`);
  }

  public recordTokenCreation(
    tokenName: string,
    tokenId: string,
    controllerContract?: string
  ): void {
    if (!this.registry.deployments.tokens[tokenName]) {
      throw new Error(`Token ${tokenName} not found in registry`);
    }

    this.registry.deployments.tokens[tokenName] = {
      ...this.registry.deployments.tokens[tokenName],
      tokenId,
      createdAt: new Date().toISOString(),
      verified: false,
      controller: controllerContract || null
    };

    this.saveRegistry();
    console.log(`🪙 Recorded token creation: ${tokenName} = ${tokenId}`);
  }

  public verifyDeployment(type: 'contract' | 'token', name: string): void {
    if (type === 'contract') {
      this.registry.deployments.contracts[name].verified = true;
    } else {
      this.registry.deployments.tokens[name].verified = true;
    }
    this.saveRegistry();
    console.log(`✅ Verified ${type}: ${name}`);
  }

  public getContractId(contractName: string): string | null {
    return this.registry.deployments.contracts[contractName]?.hederaId || null;
  }

  public getTokenId(tokenName: string): string | null {
    return this.registry.deployments.tokens[tokenName]?.tokenId || null;
  }

  public validateEnvironment(): boolean {
    console.log('\n🔍 Validating deployment environment...\n');
    
    let isValid = true;

    // Check contracts
    for (const [name, contract] of Object.entries(this.registry.deployments.contracts)) {
      if (!contract.hederaId || !contract.verified) {
        console.log(`❌ Contract ${name}: Missing or unverified deployment`);
        isValid = false;
      } else {
        console.log(`✅ Contract ${name}: ${contract.hederaId}`);
      }
    }

    // Check tokens
    for (const [name, token] of Object.entries(this.registry.deployments.tokens)) {
      if (!token.tokenId || !token.verified) {
        console.log(`❌ Token ${name}: Missing or unverified`);
        isValid = false;
      } else {
        console.log(`✅ Token ${name}: ${token.tokenId}`);
      }
    }

    console.log(isValid ? '\n🎉 Environment is valid!' : '\n💥 Environment has issues!');
    return isValid;
  }

  public generateEnvironmentFile(): void {
    console.log('\n📄 Environment Variables Needed:');
    console.log('================================');
    console.log(`NEXT_PUBLIC_LYNX_CONTRACT_HEDERA_ID=${this.getContractId('IndexTokenController') || 'NOT_DEPLOYED'}`);
    console.log(`NEXT_PUBLIC_VAULT_CONTRACT_ID=${this.getContractId('IndexVault') || 'NOT_DEPLOYED'}`);
    console.log(`NEXT_PUBLIC_LYNX_TOKEN_ID=${this.getTokenId('LYNX') || 'NOT_CREATED'}`);
    console.log(`NEXT_PUBLIC_SAUCE_TOKEN_ID=${this.getTokenId('SAUCE') || '0.0.1183558'}`);
    console.log(`NEXT_PUBLIC_CLXY_TOKEN_ID=${this.getTokenId('CLXY') || '0.0.5365'}`);
    console.log('================================');
    console.log('📝 Copy these values to your .env.local file manually');
  }

  public printStatus(): void {
    console.log('\n📊 Deployment Status:\n');
    console.log('Contracts:');
    for (const [name, contract] of Object.entries(this.registry.deployments.contracts)) {
      const status = contract.verified ? '✅' : contract.hederaId ? '⚠️' : '❌';
      console.log(`  ${status} ${name}: ${contract.hederaId || 'NOT_DEPLOYED'}`);
    }
    
    console.log('\nTokens:');
    for (const [name, token] of Object.entries(this.registry.deployments.tokens)) {
      const status = token.verified ? '✅' : token.tokenId ? '⚠️' : '❌';
      console.log(`  ${status} ${name}: ${token.tokenId || 'NOT_CREATED'}`);
    }
  }
} 