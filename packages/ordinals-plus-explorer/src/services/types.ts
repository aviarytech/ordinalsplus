import { ApiProviderType } from './ApiServiceProvider';

export interface ApiServiceConfig {
  type: ApiProviderType;
  baseUrl: string;
  apiKey?: string;
}

export interface NetworkConfig {
  name: string;
  baseUrl: string;
  isTestnet: boolean;
} 