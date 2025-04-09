declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_OPERATOR_ID: string;
    OPERATOR_KEY: string;
    HEDERA_TESTNET_ENDPOINT?: string;
  }
} 