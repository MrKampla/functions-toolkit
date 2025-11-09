import { Wallet, Contract, ContractFactory, utils, providers } from 'ethers'
import { createPublicClient, http } from 'viem'
import { anvil } from 'viem/chains'
import cbor from 'cbor'

import { simulateScript } from './simulateScript'
import {
  simulatedRouterConfig,
  simulatedCoordinatorConfig,
  simulatedAllowListConfig,
  simulatedDonId,
  simulatedAllowListId,
  simulatedLinkEthPrice,
  callReportGasLimit,
  simulatedSecretsKeys,
  DEFAULT_MAX_ON_CHAIN_RESPONSE_BYTES,
  numberOfSimulatedNodeExecutions,
  simulatedLinkUsdPrice,
} from './simulationConfig'
import {
  LinkTokenSource,
  MockV3AggregatorSource,
  FunctionsRouterSource,
  FunctionsCoordinatorTestHelperSource,
  TermsOfServiceAllowListSource,
} from './v1_contract_sources'

import type {
  FunctionsRequestParams,
  RequestCommitment,
  LocalFunctionsTestnet,
  GetFunds,
  FunctionsContracts,
  RequestEventData,
} from './types'

export const startLocalFunctionsTestnet = async (
  simulationConfigPath?: string,
  port = 8545,
): Promise<LocalFunctionsTestnet> => {
  // this is a hardcoded private key provided by anvil, defined here: https://book.getfoundry.sh/anvil/#getting-started
  const privateKey =
    process.env.FUNCTIONS_TOOLKIT_PRIVATE_KEY ||
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

  const admin = new Wallet(privateKey, new providers.JsonRpcProvider(`http://127.0.0.1:${port}`))
  const publicClient = createPublicClient({
    chain: anvil,
    transport: http(`http://127.0.0.1:${port}`),
  })

  const contracts = await deployFunctionsOracle(admin)

  const unwatchOracleRequest = publicClient.watchContractEvent({
    address: contracts.functionsMockCoordinatorContract.address as `0x${string}`,
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
    ] as const,
    eventName: 'OracleRequest',
    onLogs: logs => {
      return Promise.all(
        logs.map(async log => {
          const {
            requestId,
            requestingContract,
            requestInitiator,
            subscriptionId,
            subscriptionOwner,
            data,
            dataVersion,
            flags,
            callbackGasLimit,
            commitment,
          } = log.args
          if (
            !requestId ||
            !requestingContract ||
            !requestInitiator ||
            !subscriptionId ||
            !subscriptionOwner ||
            !data ||
            !dataVersion ||
            !flags ||
            !callbackGasLimit ||
            !commitment
          ) {
            return
          }
          console.log(`OracleRequest event received: ${requestId}`)
          const requestEvent: RequestEventData = {
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
          }
          return await handleOracleRequest(
            requestEvent,
            contracts.functionsMockCoordinatorContract,
            admin,
            simulationConfigPath,
          )
        }),
      )
    },
  })

  // contracts.functionsMockCoordinatorContract.on(
  //   'OracleRequest',
  //   (
  //     requestId,
  //     requestingContract,
  //     requestInitiator,
  //     subscriptionId,
  //     subscriptionOwner,
  //     data,
  //     dataVersion,
  //     flags,
  //     callbackGasLimit,
  //     commitment,
  //   ) => {
  //     const requestEvent: RequestEventData = {
  //       requestId,
  //       requestingContract,
  //       requestInitiator,
  //       subscriptionId,
  //       subscriptionOwner,
  //       data,
  //       dataVersion,
  //       flags,
  //       callbackGasLimit,
  //       commitment,
  //     }
  //     handleOracleRequest(
  //       requestEvent,
  //       contracts.functionsMockCoordinatorContract,
  //       admin,
  //       simulationConfigPath,
  //     )
  //   },
  // )

  const getFunds: GetFunds = async (address, { weiAmount, juelsAmount }) => {
    if (!juelsAmount) {
      juelsAmount = BigInt(0)
    }
    if (!weiAmount) {
      weiAmount = BigInt(0)
    }
    if (typeof weiAmount !== 'string' && typeof weiAmount !== 'bigint') {
      throw Error(`weiAmount must be a BigInt or string, got ${typeof weiAmount}`)
    }
    if (typeof juelsAmount !== 'string' && typeof juelsAmount !== 'bigint') {
      throw Error(`juelsAmount must be a BigInt or string, got ${typeof juelsAmount}`)
    }
    weiAmount = BigInt(weiAmount)
    juelsAmount = BigInt(juelsAmount)
    const ethTx = await admin.sendTransaction({
      to: address,
      value: weiAmount.toString(),
    })
    const linkTx = await contracts.linkTokenContract.connect(admin).transfer(address, juelsAmount)
    await ethTx.wait(1)
    await linkTx.wait(1)
    console.log(
      `Sent ${utils.formatEther(weiAmount.toString())} ETH and ${utils.formatEther(
        juelsAmount.toString(),
      )} LINK to ${address}`,
    )
  }

  const close = async (): Promise<void> => {
    contracts.functionsMockCoordinatorContract.removeAllListeners('OracleRequest')
    unwatchOracleRequest()
  }

  return {
    adminWallet: {
      address: admin.address,
      privateKey: admin.privateKey,
    },
    ...contracts,
    getFunds,
    close,
  }
}

const handleOracleRequest = async (
  requestEventData: RequestEventData,
  mockCoordinator: Contract,
  admin: Wallet,
  simulationConfigPath?: string,
) => {
  const response = await simulateDONExecution(requestEventData, simulationConfigPath)

  const errorHexstring = response.errorString
    ? '0x' + Buffer.from(response.errorString.toString()).toString('hex')
    : undefined
  const encodedReport = encodeReport(
    requestEventData.requestId,
    requestEventData.commitment,
    response.responseBytesHexstring,
    errorHexstring,
  )

  const reportTx = await mockCoordinator
    .connect(admin)
    .callReport(encodedReport, { gasLimit: callReportGasLimit })
  await reportTx.wait(1)
}

const simulateDONExecution = async (
  requestEventData: RequestEventData,
  simulationConfigPath?: string,
): Promise<{ responseBytesHexstring?: string; errorString?: string }> => {
  let requestData: FunctionsRequestParams
  try {
    requestData = await buildRequestObject(requestEventData.data)
  } catch {
    return {
      errorString: 'CBOR parsing error',
    }
  }

  const simulationConfig = simulationConfigPath ? require(simulationConfigPath) : {}

  // Perform the simulation numberOfSimulatedNodeExecution times
  const simulations = [...Array(numberOfSimulatedNodeExecutions)].map(async () => {
    try {
      return await simulateScript({
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
      })
    } catch (err) {
      const errorString = (err as Error).message.slice(
        0,
        simulationConfig.maxOnChainResponseBytes ?? DEFAULT_MAX_ON_CHAIN_RESPONSE_BYTES,
      )
      return {
        errorString,
        capturedTerminalOutput: '',
      }
    }
  })
  const responses = await Promise.all(simulations)

  const successfulResponses = responses.filter(response => response.errorString === undefined)
  const errorResponses = responses.filter(response => response.errorString !== undefined)

  if (successfulResponses.length > errorResponses.length) {
    return {
      responseBytesHexstring: aggregateMedian(
        successfulResponses.map(response => response.responseBytesHexstring!),
      ),
    }
  } else {
    return {
      errorString: aggregateModeString(errorResponses.map(response => response.errorString!)),
    }
  }
}

const aggregateMedian = (responses: string[]): string => {
  const bufResponses = responses.map(response => Buffer.from(response.slice(2), 'hex'))

  bufResponses.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length
    }
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return a[i] - b[i]
      }
    }
    return 0
  })

  return '0x' + bufResponses[Math.floor((bufResponses.length - 1) / 2)].toString('hex')
}

const aggregateModeString = (items: string[]): string => {
  const counts = new Map<string, number>()

  for (const str of items) {
    const existingCount = counts.get(str) || 0
    counts.set(str, existingCount + 1)
  }

  let modeString = items[0]
  let maxCount = counts.get(modeString) || 0

  for (const [str, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count
      modeString = str
    }
  }

  return modeString
}

const encodeReport = (
  requestId: string,
  commitment: RequestCommitment,
  result?: string,
  error?: string,
): string => {
  const encodedCommitment = utils.defaultAbiCoder.encode(
    [
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
    ],
    [
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
    ],
  )
  const encodedReport = utils.defaultAbiCoder.encode(
    ['bytes32[]', 'bytes[]', 'bytes[]', 'bytes[]', 'bytes[]'],
    [[requestId], [result ?? []], [error ?? []], [encodedCommitment], [[]]],
  )
  return encodedReport
}

const buildRequestObject = async (
  requestDataHexString: string,
): Promise<FunctionsRequestParams> => {
  const decodedRequestData = await cbor.decodeAll(Buffer.from(requestDataHexString.slice(2), 'hex'))

  if (typeof decodedRequestData[0] === 'object') {
    if (decodedRequestData[0].bytesArgs) {
      decodedRequestData[0].bytesArgs = decodedRequestData[0].bytesArgs?.map((bytesArg: Buffer) => {
        return '0x' + bytesArg?.toString('hex')
      })
    }
    decodedRequestData[0].secrets = undefined
    return decodedRequestData[0] as FunctionsRequestParams
  }
  const requestDataObject = {} as FunctionsRequestParams
  // The decoded request data is an array of alternating keys and values, therefore we can iterate over it in steps of 2
  for (let i = 0; i < decodedRequestData.length - 1; i += 2) {
    const requestDataKey = decodedRequestData[i]
    const requestDataValue = decodedRequestData[i + 1]
    switch (requestDataKey) {
      case 'codeLocation':
        requestDataObject.codeLocation = requestDataValue
        break
      case 'secretsLocation':
        // Unused as secrets provided as an argument to startLocalFunctionsTestnet() are used instead
        break
      case 'language':
        requestDataObject.codeLanguage = requestDataValue
        break
      case 'source':
        requestDataObject.source = requestDataValue
        break
      case 'secrets':
        // Unused as secrets provided as an argument to startLocalFunctionsTestnet() are used instead
        break
      case 'args':
        requestDataObject.args = requestDataValue
        break
      case 'bytesArgs':
        requestDataObject.bytesArgs = requestDataValue?.map((bytesArg: Buffer) => {
          return '0x' + bytesArg?.toString('hex')
        })
        break
      default:
      // Ignore unknown keys
    }
  }

  return requestDataObject
}

export const deployFunctionsOracle = async (deployer: Wallet): Promise<FunctionsContracts> => {
  const linkTokenFactory = new ContractFactory(
    LinkTokenSource.abi,
    LinkTokenSource.bytecode,
    deployer,
  )
  const linkToken = await linkTokenFactory.connect(deployer).deploy()

  const linkPriceFeedFactory = new ContractFactory(
    MockV3AggregatorSource.abi,
    MockV3AggregatorSource.bytecode,
    deployer,
  )
  const linkEthPriceFeed = await linkPriceFeedFactory
    .connect(deployer)
    .deploy(18, simulatedLinkEthPrice)
  const linkUsdPriceFeed = await linkPriceFeedFactory
    .connect(deployer)
    .deploy(8, simulatedLinkUsdPrice)

  const routerFactory = new ContractFactory(
    FunctionsRouterSource.abi,
    FunctionsRouterSource.bytecode,
    deployer,
  )
  const router = await routerFactory
    .connect(deployer)
    .deploy(linkToken.address, simulatedRouterConfig)

  const mockCoordinatorFactory = new ContractFactory(
    FunctionsCoordinatorTestHelperSource.abi,
    FunctionsCoordinatorTestHelperSource.bytecode,
    deployer,
  )
  const mockCoordinator = await mockCoordinatorFactory
    .connect(deployer)
    .deploy(
      router.address,
      simulatedCoordinatorConfig,
      linkEthPriceFeed.address,
      linkUsdPriceFeed.address,
    )

  const allowlistFactory = new ContractFactory(
    TermsOfServiceAllowListSource.abi,
    TermsOfServiceAllowListSource.bytecode,
    deployer,
  )
  const initialAllowedSenders: string[] = []
  const initialBlockedSenders: string[] = []
  const allowlist = await allowlistFactory
    .connect(deployer)
    .deploy(simulatedAllowListConfig, initialAllowedSenders, initialBlockedSenders)

  const setAllowListIdTx = await router.setAllowListId(
    utils.formatBytes32String(simulatedAllowListId),
  )
  await setAllowListIdTx.wait(1)

  const allowlistId = await router.getAllowListId()
  const proposeContractsTx = await router.proposeContractsUpdate(
    [allowlistId, utils.formatBytes32String(simulatedDonId)],
    [allowlist.address, mockCoordinator.address],
    {
      gasLimit: 1_000_000,
    },
  )
  await proposeContractsTx.wait(1)
  await router.updateContracts({ gasLimit: 1_000_000 })

  await mockCoordinator.connect(deployer).setDONPublicKey(simulatedSecretsKeys.donKey.publicKey)
  await mockCoordinator
    .connect(deployer)
    .setThresholdPublicKey(
      '0x' + Buffer.from(simulatedSecretsKeys.thresholdKeys.publicKey).toString('hex'),
    )

  return {
    donId: simulatedDonId,
    linkTokenContract: linkToken,
    functionsRouterContract: router,
    functionsMockCoordinatorContract: mockCoordinator,
  }
}
