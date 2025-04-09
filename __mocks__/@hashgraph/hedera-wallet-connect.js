// Mock implementation of @hashgraph/hedera-wallet-connect

class DAppConnector {
  constructor() {
    this.isConnected = false;
    this.accountId = null;
    this.network = null;
  }
  
  connect() {
    this.isConnected = true;
    this.accountId = '0.0.12345';
    this.network = 'testnet';
    return Promise.resolve();
  }
  
  disconnect() {
    this.isConnected = false;
    this.accountId = null;
    this.network = null;
    return Promise.resolve();
  }
  
  sign() {
    return Promise.resolve({ success: true, transaction: {} });
  }

  getAccountId() {
    return this.accountId;
  }

  isConnected() {
    return this.isConnected;
  }

  getNetwork() {
    return this.network;
  }
}

class HashConnect {
  constructor() {
    this.status = 'initialized';
  }

  init() {
    return Promise.resolve();
  }
}

// Export the mock classes
module.exports = {
  DAppConnector,
  HashConnect
}; 