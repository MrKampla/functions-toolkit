import type { providers } from 'ethers';
import { type FunctionsResponse } from './types';
export declare class ResponseListener {
    private functionsRouter;
    private provider;
    constructor({ provider, functionsRouterAddress, }: {
        provider: providers.Provider;
        functionsRouterAddress: string;
    });
    listenForResponse(requestId: string, timeoutMs?: number): Promise<FunctionsResponse>;
    /**
     *
     * @param txHash Tx hash for the Functions Request
     * @param timeoutMs after which the listener throws, indicating  the time limit was exceeded (default 5 minutes)
     * @param confirmations  number of confirmations to wait for before considering the transaction successful (default 1, but recommend 2 or more)
     * @param checkIntervalMs frequency of checking if the Tx is  included on-chain (or if it got moved after a chain re-org) (default 2 seconds. Intervals longer than block time may cause the listener to wait indefinitely.)
     * @returns
     */
    listenForResponseFromTransaction(txHash: string, timeoutMs?: number, confirmations?: number, checkIntervalMs?: number): Promise<FunctionsResponse>;
    listenForResponses(subscriptionId: number | string, callback: (functionsResponse: FunctionsResponse) => any): void;
    stopListeningForResponses(): void;
}
