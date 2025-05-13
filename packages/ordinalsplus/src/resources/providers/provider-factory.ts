import { ResourceProvider } from './types';
import { OrdiscanProvider, OrdiscanProviderOptions } from './ordiscan-provider';
import { OrdNodeProvider, OrdNodeProviderOptions } from './ord-node-provider';

export enum ProviderType {
    ORDISCAN = 'ordiscan',
    ORD = 'ord'
}

export interface ProviderConfig {
    type: ProviderType;
    options: OrdiscanProviderOptions | OrdNodeProviderOptions;
}

export class ProviderFactory {
    static createProvider(config: ProviderConfig): ResourceProvider {
        switch (config.type) {
            case ProviderType.ORDISCAN:
                return new OrdiscanProvider(config.options as OrdiscanProviderOptions);
            case ProviderType.ORD:
                return new OrdNodeProvider(config.options as OrdNodeProviderOptions);
            default:
                throw new Error(`Unsupported provider type: ${config.type}`);
        }
    }
} 