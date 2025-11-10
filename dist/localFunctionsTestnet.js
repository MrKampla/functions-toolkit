"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployFunctionsOracle = exports.startLocalFunctionsTestnet = void 0;
const ethers_1 = require("ethers");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const cbor_1 = __importDefault(require("cbor"));
const simulateScript_1 = require("./simulateScript");
const simulationConfig_1 = require("./simulationConfig");
const v1_contract_sources_1 = require("./v1_contract_sources");
const accounts_1 = require("viem/accounts");
const startLocalFunctionsTestnet = async (simulationConfigPath, port = 8545) => {
    // this is a hardcoded private key provided by anvil, defined here: https://book.getfoundry.sh/anvil/#getting-started
    const privateKey = process.env.FUNCTIONS_TOOLKIT_PRIVATE_KEY ||
        'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const adminWallet = (0, viem_1.createWalletClient)({
        account: (0, accounts_1.privateKeyToAccount)(`0x${privateKey}`),
        chain: chains_1.anvil,
        transport: (0, viem_1.http)(`http://127.0.0.1:${port}`),
    });
    const publicClient = (0, viem_1.createPublicClient)({
        chain: chains_1.anvil,
        transport: (0, viem_1.http)(`http://127.0.0.1:${port}`),
    });
    const admin = new ethers_1.Wallet(privateKey, new ethers_1.providers.JsonRpcProvider(`http://127.0.0.1:${port}`));
    const contracts = await (0, exports.deployFunctionsOracle)(admin);
    const unwatchOracleRequest = publicClient.watchContractEvent({
        address: contracts.functionsMockCoordinatorContract.address,
        abi: [
            {
                anonymous: false,
                inputs: [
                    {
                        indexed: true,
                        internalType: 'bytes32',
                        name: 'requestId',
                        type: 'bytes32',
                    },
                    {
                        indexed: true,
                        internalType: 'address',
                        name: 'requestingContract',
                        type: 'address',
                    },
                    {
                        indexed: false,
                        internalType: 'address',
                        name: 'requestInitiator',
                        type: 'address',
                    },
                    {
                        indexed: false,
                        internalType: 'uint64',
                        name: 'subscriptionId',
                        type: 'uint64',
                    },
                    {
                        indexed: false,
                        internalType: 'address',
                        name: 'subscriptionOwner',
                        type: 'address',
                    },
                    {
                        indexed: false,
                        internalType: 'bytes',
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        indexed: false,
                        internalType: 'uint16',
                        name: 'dataVersion',
                        type: 'uint16',
                    },
                    {
                        indexed: false,
                        internalType: 'bytes32',
                        name: 'flags',
                        type: 'bytes32',
                    },
                    {
                        indexed: false,
                        internalType: 'uint64',
                        name: 'callbackGasLimit',
                        type: 'uint64',
                    },
                    {
                        components: [
                            {
                                internalType: 'bytes32',
                                name: 'requestId',
                                type: 'bytes32',
                            },
                            {
                                internalType: 'address',
                                name: 'coordinator',
                                type: 'address',
                            },
                            {
                                internalType: 'uint96',
                                name: 'estimatedTotalCostJuels',
                                type: 'uint96',
                            },
                            {
                                internalType: 'address',
                                name: 'client',
                                type: 'address',
                            },
                            {
                                internalType: 'uint64',
                                name: 'subscriptionId',
                                type: 'uint64',
                            },
                            {
                                internalType: 'uint32',
                                name: 'callbackGasLimit',
                                type: 'uint32',
                            },
                            {
                                internalType: 'uint72',
                                name: 'adminFee',
                                type: 'uint72',
                            },
                            {
                                internalType: 'uint72',
                                name: 'donFee',
                                type: 'uint72',
                            },
                            {
                                internalType: 'uint40',
                                name: 'gasOverheadBeforeCallback',
                                type: 'uint40',
                            },
                            {
                                internalType: 'uint40',
                                name: 'gasOverheadAfterCallback',
                                type: 'uint40',
                            },
                            {
                                internalType: 'uint32',
                                name: 'timeoutTimestamp',
                                type: 'uint32',
                            },
                        ],
                        indexed: false,
                        internalType: 'struct FunctionsResponse.Commitment',
                        name: 'commitment',
                        type: 'tuple',
                    },
                ],
                name: 'OracleRequest',
                type: 'event',
            },
        ],
        eventName: 'OracleRequest',
        onLogs: logs => {
            return Promise.all(logs.map(async (log) => {
                const { requestId, requestingContract, requestInitiator, subscriptionId, subscriptionOwner, data, dataVersion, flags, callbackGasLimit, commitment, } = log.args;
                if (!requestId ||
                    !requestingContract ||
                    !requestInitiator ||
                    !subscriptionId ||
                    !subscriptionOwner ||
                    !data ||
                    !dataVersion ||
                    !flags ||
                    !callbackGasLimit ||
                    !commitment) {
                    return;
                }
                console.log(`OracleRequest event received: ${requestId}`);
                const requestEvent = {
                    requestId,
                    requestingContract,
                    requestInitiator,
                    subscriptionId: Number(subscriptionId),
                    subscriptionOwner,
                    data,
                    dataVersion,
                    flags,
                    callbackGasLimit: Number(callbackGasLimit),
                    commitment: {
                        adminFee: commitment.adminFee,
                        donFee: commitment.donFee,
                        gasOverheadBeforeCallback: BigInt(commitment.gasOverheadBeforeCallback),
                        gasOverheadAfterCallback: BigInt(commitment.gasOverheadAfterCallback),
                        timeoutTimestamp: BigInt(commitment.timeoutTimestamp),
                        requestId,
                        coordinator: commitment.coordinator,
                        estimatedTotalCostJuels: commitment.estimatedTotalCostJuels,
                        client: commitment.client,
                        subscriptionId: Number(subscriptionId),
                        callbackGasLimit: BigInt(callbackGasLimit),
                    },
                };
                return await handleOracleRequest(requestEvent, contracts.functionsMockCoordinatorContract.address, adminWallet, publicClient, simulationConfigPath);
            }));
        },
    });
    const getFunds = async (address, { weiAmount, juelsAmount }) => {
        if (!juelsAmount) {
            juelsAmount = BigInt(0);
        }
        if (!weiAmount) {
            weiAmount = BigInt(0);
        }
        if (typeof weiAmount !== 'string' && typeof weiAmount !== 'bigint') {
            throw Error(`weiAmount must be a BigInt or string, got ${typeof weiAmount}`);
        }
        if (typeof juelsAmount !== 'string' && typeof juelsAmount !== 'bigint') {
            throw Error(`juelsAmount must be a BigInt or string, got ${typeof juelsAmount}`);
        }
        weiAmount = BigInt(weiAmount);
        juelsAmount = BigInt(juelsAmount);
        const ethTx = await admin.sendTransaction({
            to: address,
            value: weiAmount.toString(),
        });
        const linkTx = await contracts.linkTokenContract.connect(admin).transfer(address, juelsAmount);
        await ethTx.wait(1);
        await linkTx.wait(1);
        console.log(`Sent ${ethers_1.utils.formatEther(weiAmount.toString())} ETH and ${ethers_1.utils.formatEther(juelsAmount.toString())} LINK to ${address}`);
    };
    const close = async () => {
        contracts.functionsMockCoordinatorContract.removeAllListeners('OracleRequest');
        unwatchOracleRequest();
    };
    return {
        adminWallet: {
            address: admin.address,
            privateKey: admin.privateKey,
        },
        ...contracts,
        getFunds,
        close,
    };
};
exports.startLocalFunctionsTestnet = startLocalFunctionsTestnet;
const handleOracleRequest = async (requestEventData, mockCoordinatorAddress, adminWallet, publicClient, simulationConfigPath) => {
    const response = await simulateDONExecution(requestEventData, simulationConfigPath);
    const errorHexstring = response.errorString
        ? '0x' + Buffer.from(response.errorString.toString()).toString('hex')
        : undefined;
    const encodedReport = encodeReport(requestEventData.requestId, requestEventData.commitment, response.responseBytesHexstring, errorHexstring);
    const reportTx = await adminWallet.writeContract({
        address: mockCoordinatorAddress,
        abi: [
            {
                inputs: [
                    {
                        internalType: 'bytes',
                        name: 'report',
                        type: 'bytes',
                    },
                ],
                name: 'callReport',
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function',
            },
        ],
        functionName: 'callReport',
        args: [encodedReport],
        gas: BigInt(simulationConfig_1.callReportGasLimit),
    });
    await publicClient.waitForTransactionReceipt({ hash: reportTx });
};
const simulateDONExecution = async (requestEventData, simulationConfigPath) => {
    let requestData;
    try {
        requestData = await buildRequestObject(requestEventData.data);
    }
    catch {
        return {
            errorString: 'CBOR parsing error',
        };
    }
    const simulationConfig = simulationConfigPath ? require(simulationConfigPath) : {};
    // Perform the simulation numberOfSimulatedNodeExecution times
    const simulations = [...Array(simulationConfig_1.numberOfSimulatedNodeExecutions)].map(async () => {
        try {
            return await (0, simulateScript_1.simulateScript)({
                source: requestData.source,
                secrets: simulationConfig.secrets, // Secrets are taken from simulationConfig, not request data included in transaction
                args: requestData.args,
                bytesArgs: requestData.bytesArgs,
                maxOnChainResponseBytes: simulationConfig.maxOnChainResponseBytes,
                maxExecutionTimeMs: simulationConfig.maxExecutionTimeMs,
                maxMemoryUsageMb: simulationConfig.maxMemoryUsageMb,
                numAllowedQueries: simulationConfig.numAllowedQueries,
                maxQueryDurationMs: simulationConfig.maxQueryDurationMs,
                maxQueryUrlLength: simulationConfig.maxQueryUrlLength,
                maxQueryRequestBytes: simulationConfig.maxQueryRequestBytes,
                maxQueryResponseBytes: simulationConfig.maxQueryResponseBytes,
            });
        }
        catch (err) {
            const errorString = err.message.slice(0, simulationConfig.maxOnChainResponseBytes ?? simulationConfig_1.DEFAULT_MAX_ON_CHAIN_RESPONSE_BYTES);
            return {
                errorString,
                capturedTerminalOutput: '',
            };
        }
    });
    const responses = await Promise.all(simulations);
    const successfulResponses = responses.filter(response => response.errorString === undefined);
    const errorResponses = responses.filter(response => response.errorString !== undefined);
    if (successfulResponses.length > errorResponses.length) {
        return {
            responseBytesHexstring: aggregateMedian(successfulResponses.map(response => response.responseBytesHexstring)),
        };
    }
    else {
        return {
            errorString: aggregateModeString(errorResponses.map(response => response.errorString)),
        };
    }
};
const aggregateMedian = (responses) => {
    const bufResponses = responses.map(response => Buffer.from(response.slice(2), 'hex'));
    bufResponses.sort((a, b) => {
        if (a.length !== b.length) {
            return a.length - b.length;
        }
        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) {
                return a[i] - b[i];
            }
        }
        return 0;
    });
    return '0x' + bufResponses[Math.floor((bufResponses.length - 1) / 2)].toString('hex');
};
const aggregateModeString = (items) => {
    const counts = new Map();
    for (const str of items) {
        const existingCount = counts.get(str) || 0;
        counts.set(str, existingCount + 1);
    }
    let modeString = items[0];
    let maxCount = counts.get(modeString) || 0;
    for (const [str, count] of counts.entries()) {
        if (count > maxCount) {
            maxCount = count;
            modeString = str;
        }
    }
    return modeString;
};
const encodeReport = (requestId, commitment, result, error) => {
    const encodedCommitment = ethers_1.utils.defaultAbiCoder.encode([
        'bytes32',
        'address',
        'uint96',
        'address',
        'uint64',
        'uint32',
        'uint72',
        'uint72',
        'uint40',
        'uint40',
        'uint32',
    ], [
        commitment.requestId,
        commitment.coordinator,
        commitment.estimatedTotalCostJuels,
        commitment.client,
        commitment.subscriptionId,
        commitment.callbackGasLimit,
        commitment.adminFee,
        commitment.donFee,
        commitment.gasOverheadBeforeCallback,
        commitment.gasOverheadAfterCallback,
        commitment.timeoutTimestamp,
    ]);
    const encodedReport = ethers_1.utils.defaultAbiCoder.encode(['bytes32[]', 'bytes[]', 'bytes[]', 'bytes[]', 'bytes[]'], [[requestId], [result ?? []], [error ?? []], [encodedCommitment], [[]]]);
    return encodedReport;
};
const buildRequestObject = async (requestDataHexString) => {
    const decodedRequestData = await cbor_1.default.decodeAll(Buffer.from(requestDataHexString.slice(2), 'hex'));
    if (typeof decodedRequestData[0] === 'object') {
        if (decodedRequestData[0].bytesArgs) {
            decodedRequestData[0].bytesArgs = decodedRequestData[0].bytesArgs?.map((bytesArg) => {
                return '0x' + bytesArg?.toString('hex');
            });
        }
        decodedRequestData[0].secrets = undefined;
        return decodedRequestData[0];
    }
    const requestDataObject = {};
    // The decoded request data is an array of alternating keys and values, therefore we can iterate over it in steps of 2
    for (let i = 0; i < decodedRequestData.length - 1; i += 2) {
        const requestDataKey = decodedRequestData[i];
        const requestDataValue = decodedRequestData[i + 1];
        switch (requestDataKey) {
            case 'codeLocation':
                requestDataObject.codeLocation = requestDataValue;
                break;
            case 'secretsLocation':
                // Unused as secrets provided as an argument to startLocalFunctionsTestnet() are used instead
                break;
            case 'language':
                requestDataObject.codeLanguage = requestDataValue;
                break;
            case 'source':
                requestDataObject.source = requestDataValue;
                break;
            case 'secrets':
                // Unused as secrets provided as an argument to startLocalFunctionsTestnet() are used instead
                break;
            case 'args':
                requestDataObject.args = requestDataValue;
                break;
            case 'bytesArgs':
                requestDataObject.bytesArgs = requestDataValue?.map((bytesArg) => {
                    return '0x' + bytesArg?.toString('hex');
                });
                break;
            default:
            // Ignore unknown keys
        }
    }
    return requestDataObject;
};
const deployFunctionsOracle = async (deployer) => {
    const linkTokenFactory = new ethers_1.ContractFactory(v1_contract_sources_1.LinkTokenSource.abi, v1_contract_sources_1.LinkTokenSource.bytecode, deployer);
    const linkToken = await linkTokenFactory.connect(deployer).deploy();
    const linkPriceFeedFactory = new ethers_1.ContractFactory(v1_contract_sources_1.MockV3AggregatorSource.abi, v1_contract_sources_1.MockV3AggregatorSource.bytecode, deployer);
    const linkEthPriceFeed = await linkPriceFeedFactory
        .connect(deployer)
        .deploy(18, simulationConfig_1.simulatedLinkEthPrice);
    const linkUsdPriceFeed = await linkPriceFeedFactory
        .connect(deployer)
        .deploy(8, simulationConfig_1.simulatedLinkUsdPrice);
    const routerFactory = new ethers_1.ContractFactory(v1_contract_sources_1.FunctionsRouterSource.abi, v1_contract_sources_1.FunctionsRouterSource.bytecode, deployer);
    const router = await routerFactory
        .connect(deployer)
        .deploy(linkToken.address, simulationConfig_1.simulatedRouterConfig);
    const mockCoordinatorFactory = new ethers_1.ContractFactory(v1_contract_sources_1.FunctionsCoordinatorTestHelperSource.abi, v1_contract_sources_1.FunctionsCoordinatorTestHelperSource.bytecode, deployer);
    const mockCoordinator = await mockCoordinatorFactory
        .connect(deployer)
        .deploy(router.address, simulationConfig_1.simulatedCoordinatorConfig, linkEthPriceFeed.address, linkUsdPriceFeed.address);
    const allowlistFactory = new ethers_1.ContractFactory(v1_contract_sources_1.TermsOfServiceAllowListSource.abi, v1_contract_sources_1.TermsOfServiceAllowListSource.bytecode, deployer);
    const initialAllowedSenders = [];
    const initialBlockedSenders = [];
    const allowlist = await allowlistFactory
        .connect(deployer)
        .deploy(simulationConfig_1.simulatedAllowListConfig, initialAllowedSenders, initialBlockedSenders);
    const setAllowListIdTx = await router.setAllowListId(ethers_1.utils.formatBytes32String(simulationConfig_1.simulatedAllowListId));
    await setAllowListIdTx.wait(1);
    const allowlistId = await router.getAllowListId();
    const proposeContractsTx = await router.proposeContractsUpdate([allowlistId, ethers_1.utils.formatBytes32String(simulationConfig_1.simulatedDonId)], [allowlist.address, mockCoordinator.address], {
        gasLimit: 1_000_000,
    });
    await proposeContractsTx.wait(1);
    await router.updateContracts({ gasLimit: 1_000_000 });
    await mockCoordinator.connect(deployer).setDONPublicKey(simulationConfig_1.simulatedSecretsKeys.donKey.publicKey);
    await mockCoordinator
        .connect(deployer)
        .setThresholdPublicKey('0x' + Buffer.from(simulationConfig_1.simulatedSecretsKeys.thresholdKeys.publicKey).toString('hex'));
    return {
        donId: simulationConfig_1.simulatedDonId,
        linkTokenContract: linkToken,
        functionsRouterContract: router,
        functionsMockCoordinatorContract: mockCoordinator,
    };
};
exports.deployFunctionsOracle = deployFunctionsOracle;
