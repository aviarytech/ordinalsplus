import * as v from 'valibot';

// Schema for API environment variables
const EnvSchema = v.object({
  ORDISCAN_API_KEY: v.optional(v.string()),
  ORD_NODE_URL: v.string(),
  CONTENT_ORD_NODE_URL: v.optional(v.string()),
  PORT: v.number(),
  HOST: v.optional(v.string()),
  API_BASE_URL: v.optional(v.string()),
  MAINNET_ORD_NODE_URL: v.optional(v.string()),
  TESTNET_ORD_NODE_URL: v.optional(v.string()),
  SIGNET_ORD_NODE_URL: v.optional(v.string()),
  MAINNET_ORDISCAN_API_KEY: v.optional(v.string()),
  TESTNET_ORDISCAN_API_KEY: v.optional(v.string()),
});

export type EnvConfig = v.InferOutput<typeof EnvSchema>;

export function loadEnv(): EnvConfig {
  try {
    const raw = {
      ORDISCAN_API_KEY: process.env.ORDISCAN_API_KEY,
      ORD_NODE_URL: process.env.ORD_NODE_URL,
      CONTENT_ORD_NODE_URL: process.env.CONTENT_ORD_NODE_URL,
      PORT: Number(process.env.PORT ?? '3001'),
      HOST: process.env.HOST ?? '0.0.0.0',
      API_BASE_URL: process.env.API_BASE_URL,
      MAINNET_ORD_NODE_URL: process.env.MAINNET_ORD_NODE_URL,
      TESTNET_ORD_NODE_URL: process.env.TESTNET_ORD_NODE_URL,
      SIGNET_ORD_NODE_URL: process.env.SIGNET_ORD_NODE_URL,
      MAINNET_ORDISCAN_API_KEY: process.env.MAINNET_ORDISCAN_API_KEY,
      TESTNET_ORDISCAN_API_KEY: process.env.TESTNET_ORDISCAN_API_KEY,
    };
    return v.parse(EnvSchema, raw);
  } catch (err) {
    console.error('Invalid API environment configuration:', err);
    process.exit(1);
  }
}

export const env = loadEnv();
