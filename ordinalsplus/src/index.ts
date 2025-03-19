// Export DID classes
import { BtcoDid } from './did/btco-did';

// Export Resource classes
import { ResourceResolver } from './resources/resource-resolver';

// Export utility functions
import {
  isValidBtcoDid,
  isValidResourceId,
  parseBtcoDid,
  parseResourceId
} from './utils/validators';

// Export constants
import * as constants from './utils/constants';

// Export types
import * as types from './types';

// Main exports
export {
  // Classes
  BtcoDid,
  ResourceResolver,
  
  // Utility functions
  isValidBtcoDid,
  isValidResourceId,
  parseBtcoDid,
  parseResourceId,
  
  // Constants
  constants,
  
  // Types
  types
};

// Default export
const OrdinalsPlus = {
  BtcoDid,
  ResourceResolver,
  utils: {
    isValidBtcoDid,
    isValidResourceId,
    parseBtcoDid,
    parseResourceId,
    constants
  },
  types
};

export default OrdinalsPlus; 