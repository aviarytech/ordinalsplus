import { BTCO_METHOD, ERROR_CODES } from '../utils/constants';
import { isValidBtcoDid, parseBtcoDid } from '../utils/validators';
import { LinkedResource } from '../types';

export class BtcoDid {
    private readonly did: string;

    constructor(did: string) {
        if (!isValidBtcoDid(did)) {
            throw new Error(`${ERROR_CODES.INVALID_DID}: Invalid BTCO DID format`);
        }
        this.did = did;
    }

    getDid(): string {
        return this.did;
    }

    getSatNumber(): number {
        const parsed = parseBtcoDid(this.did);
        if (!parsed) {
            throw new Error(`${ERROR_CODES.INVALID_DID}: Could not parse sat number`);
        }
        return parsed.satNumber;
    }

    async resolve(): Promise<LinkedResource> {
        try {
            // TODO: Implement actual API call to resolve DID
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Unable to connect. Is the computer able to access the url?`);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve DID`);
        }
    }
} 