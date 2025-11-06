import { Wallet } from 'ethers';
import type { LocalFunctionsTestnet, FunctionsContracts } from './types';
export declare const startLocalFunctionsTestnet: (simulationConfigPath?: string, port?: number) => Promise<LocalFunctionsTestnet>;
export declare const deployFunctionsOracle: (deployer: Wallet) => Promise<FunctionsContracts>;
