import { type ILogger, setLogger } from "./logger"

interface SDKConfig {
  logger?: ILogger
  env: EnvConfig
  features: {
    hyperliquid: boolean
  }
}

export interface EnvConfig {
  contractID: string
  poaBridgeBaseURL: string
  solverRelayBaseURL: string
  managerConsoleBaseURL: string
  nearIntentsBaseURL: string
}

export type NearIntentsEnv = "production" | "stage"

const configsByEnvironment: Record<NearIntentsEnv, EnvConfig> = {
  production: {
    contractID: "intents.near",
    poaBridgeBaseURL: "https://bridge.chaindefuser.com",
    solverRelayBaseURL: "https://solver-relay-v2.chaindefuser.com",
    managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
    nearIntentsBaseURL: "https://app.near-intents.org/api/",
  },
  stage: {
    contractID: "staging-intents.near",
    // todo: update URLs when available
    poaBridgeBaseURL: "https://bridge.chaindefuser.com",
    solverRelayBaseURL: "https://solver-relay-v2.chaindefuser.com",
    managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
    nearIntentsBaseURL: "https://app.near-intents.org/api/",
  },
}

export let config: SDKConfig = {
  env: configsByEnvironment.production,
  features: {
    hyperliquid: false,
  },
}

export interface ConfigureSDKArgs {
  logger?: ILogger
  env?: EnvConfig | NearIntentsEnv
  features?: { [K in keyof SDKConfig["features"]]?: boolean }
}

export function configureSDK({
  logger,
  env,
  features,
}: ConfigureSDKArgs): void {
  if (logger) {
    setLogger(logger)
  }

  if (typeof env === "string") {
    config = { ...config, env: configsByEnvironment[env] }
  } else if (env) {
    config = { ...config, env }
  }

  config = {
    ...config,
    features: {
      ...config.features,
      ...features,
    },
  }
}
