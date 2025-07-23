import * as v from 'valibot';

// Schema for API environment variables
const EnvSchema = v.object({
  ORDISCAN_API_KEY: v.string(),
  ORD_NODE_URL: v.string(),
  PORT: v.number(),
  HOST: v.optional(v.string()),
  API_BASE_URL: v.optional(v.string()),
  MAINNET_ORD_NODE_URL: v.optional(v.string()),
  TESTNET_ORD_NODE_URL: v.optional(v.string()),
  SIGNET_ORD_NODE_URL: v.optional(v.string()),
  MAINNET_ORDISCAN_API_KEY: v.optional(v.string()),
  TESTNET_ORDISCAN_API_KEY: v.optional(v.string()),
  // Additional environment variables
  ORD_SERVER_URL: v.optional(v.string()),
  REDIS_URL: v.optional(v.string()),
  LOG_LEVEL: v.optional(v.string()),
  ENABLE_FINALIZE_TEST: v.optional(v.string()),
  VC_API_URL: v.optional(v.string()),
  VC_API_AUTH_TOKEN: v.optional(v.string()),
  VC_API_DEFAULT_PROVIDER: v.optional(v.string()),
  // VC API Provider configuration (support up to 10 providers)
  VC_API_PROVIDER_1_NAME: v.optional(v.string()),
  VC_API_PROVIDER_1_URL: v.optional(v.string()),
  VC_API_PROVIDER_1_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_2_NAME: v.optional(v.string()),
  VC_API_PROVIDER_2_URL: v.optional(v.string()),
  VC_API_PROVIDER_2_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_3_NAME: v.optional(v.string()),
  VC_API_PROVIDER_3_URL: v.optional(v.string()),
  VC_API_PROVIDER_3_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_4_NAME: v.optional(v.string()),
  VC_API_PROVIDER_4_URL: v.optional(v.string()),
  VC_API_PROVIDER_4_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_5_NAME: v.optional(v.string()),
  VC_API_PROVIDER_5_URL: v.optional(v.string()),
  VC_API_PROVIDER_5_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_6_NAME: v.optional(v.string()),
  VC_API_PROVIDER_6_URL: v.optional(v.string()),
  VC_API_PROVIDER_6_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_7_NAME: v.optional(v.string()),
  VC_API_PROVIDER_7_URL: v.optional(v.string()),
  VC_API_PROVIDER_7_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_8_NAME: v.optional(v.string()),
  VC_API_PROVIDER_8_URL: v.optional(v.string()),
  VC_API_PROVIDER_8_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_9_NAME: v.optional(v.string()),
  VC_API_PROVIDER_9_URL: v.optional(v.string()),
  VC_API_PROVIDER_9_AUTH_TOKEN: v.optional(v.string()),
  VC_API_PROVIDER_10_NAME: v.optional(v.string()),
  VC_API_PROVIDER_10_URL: v.optional(v.string()),
  VC_API_PROVIDER_10_AUTH_TOKEN: v.optional(v.string()),
  // Special npm environment variables
  npm_package_version: v.optional(v.string()),
});

export type EnvConfig = v.InferOutput<typeof EnvSchema>;

export function loadEnv(): EnvConfig {
  try {
    const raw = {
      ORDISCAN_API_KEY: process.env.ORDISCAN_API_KEY,
      ORD_NODE_URL: process.env.ORD_NODE_URL,
      PORT: Number(process.env.PORT ?? '3001'),
      HOST: process.env.HOST ?? '0.0.0.0',
      API_BASE_URL: process.env.API_BASE_URL,
      MAINNET_ORD_NODE_URL: process.env.MAINNET_ORD_NODE_URL,
      TESTNET_ORD_NODE_URL: process.env.TESTNET_ORD_NODE_URL,
      SIGNET_ORD_NODE_URL: process.env.SIGNET_ORD_NODE_URL,
      MAINNET_ORDISCAN_API_KEY: process.env.MAINNET_ORDISCAN_API_KEY,
      TESTNET_ORDISCAN_API_KEY: process.env.TESTNET_ORDISCAN_API_KEY,
      // Additional environment variables
      ORD_SERVER_URL: process.env.ORD_SERVER_URL,
      REDIS_URL: process.env.REDIS_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
      ENABLE_FINALIZE_TEST: process.env.ENABLE_FINALIZE_TEST,
      VC_API_URL: process.env.VC_API_URL,
      VC_API_AUTH_TOKEN: process.env.VC_API_AUTH_TOKEN,
      VC_API_DEFAULT_PROVIDER: process.env.VC_API_DEFAULT_PROVIDER,
      // VC API Provider configuration (support up to 10 providers)
      VC_API_PROVIDER_1_NAME: process.env.VC_API_PROVIDER_1_NAME,
      VC_API_PROVIDER_1_URL: process.env.VC_API_PROVIDER_1_URL,
      VC_API_PROVIDER_1_AUTH_TOKEN: process.env.VC_API_PROVIDER_1_AUTH_TOKEN,
      VC_API_PROVIDER_2_NAME: process.env.VC_API_PROVIDER_2_NAME,
      VC_API_PROVIDER_2_URL: process.env.VC_API_PROVIDER_2_URL,
      VC_API_PROVIDER_2_AUTH_TOKEN: process.env.VC_API_PROVIDER_2_AUTH_TOKEN,
      VC_API_PROVIDER_3_NAME: process.env.VC_API_PROVIDER_3_NAME,
      VC_API_PROVIDER_3_URL: process.env.VC_API_PROVIDER_3_URL,
      VC_API_PROVIDER_3_AUTH_TOKEN: process.env.VC_API_PROVIDER_3_AUTH_TOKEN,
      VC_API_PROVIDER_4_NAME: process.env.VC_API_PROVIDER_4_NAME,
      VC_API_PROVIDER_4_URL: process.env.VC_API_PROVIDER_4_URL,
      VC_API_PROVIDER_4_AUTH_TOKEN: process.env.VC_API_PROVIDER_4_AUTH_TOKEN,
      VC_API_PROVIDER_5_NAME: process.env.VC_API_PROVIDER_5_NAME,
      VC_API_PROVIDER_5_URL: process.env.VC_API_PROVIDER_5_URL,
      VC_API_PROVIDER_5_AUTH_TOKEN: process.env.VC_API_PROVIDER_5_AUTH_TOKEN,
      VC_API_PROVIDER_6_NAME: process.env.VC_API_PROVIDER_6_NAME,
      VC_API_PROVIDER_6_URL: process.env.VC_API_PROVIDER_6_URL,
      VC_API_PROVIDER_6_AUTH_TOKEN: process.env.VC_API_PROVIDER_6_AUTH_TOKEN,
      VC_API_PROVIDER_7_NAME: process.env.VC_API_PROVIDER_7_NAME,
      VC_API_PROVIDER_7_URL: process.env.VC_API_PROVIDER_7_URL,
      VC_API_PROVIDER_7_AUTH_TOKEN: process.env.VC_API_PROVIDER_7_AUTH_TOKEN,
      VC_API_PROVIDER_8_NAME: process.env.VC_API_PROVIDER_8_NAME,
      VC_API_PROVIDER_8_URL: process.env.VC_API_PROVIDER_8_URL,
      VC_API_PROVIDER_8_AUTH_TOKEN: process.env.VC_API_PROVIDER_8_AUTH_TOKEN,
      VC_API_PROVIDER_9_NAME: process.env.VC_API_PROVIDER_9_NAME,
      VC_API_PROVIDER_9_URL: process.env.VC_API_PROVIDER_9_URL,
      VC_API_PROVIDER_9_AUTH_TOKEN: process.env.VC_API_PROVIDER_9_AUTH_TOKEN,
      VC_API_PROVIDER_10_NAME: process.env.VC_API_PROVIDER_10_NAME,
      VC_API_PROVIDER_10_URL: process.env.VC_API_PROVIDER_10_URL,
      VC_API_PROVIDER_10_AUTH_TOKEN: process.env.VC_API_PROVIDER_10_AUTH_TOKEN,
      // Special npm environment variables
      npm_package_version: process.env.npm_package_version,
    };
    return v.parse(EnvSchema, raw);
  } catch (err) {
    console.error('Invalid API environment configuration:', err);
    process.exit(1);
  }
}

export const env = loadEnv();
