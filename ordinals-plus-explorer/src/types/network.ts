export interface Network {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface NetworkConfig {
  networks: Network[];
  defaultNetwork: string;
} 