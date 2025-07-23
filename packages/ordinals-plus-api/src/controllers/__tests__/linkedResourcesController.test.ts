/**
 * Unit tests for linkedResourcesController
 * 
 * Tests the createLinkedResource and getResourceByDid functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createLinkedResource, getResourceByDid } from '../linkedResourcesController';
import type { LinkedResource } from '../../types';

describe('linkedResourcesController', () => {
  // Save original console methods for restoration
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  let consoleOutput: string[] = [];

  beforeEach(() => {
    // Mock console methods to capture output
    consoleOutput = [];
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(' '));
    };
    console.error = (...args: any[]) => {
      consoleOutput.push(`ERROR: ${args.join(' ')}`);
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('createLinkedResource', () => {
    it('should create a linked resource with required properties', async () => {
      // Arrange
      const resourceData = {
        type: 'TestResource',
        name: 'Test Resource',
        description: 'This is a test resource'
      };

      // Act
      const result = await createLinkedResource(resourceData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeString();
      expect(result.id).toStartWith('did:btco:resource:');
      expect(result.type).toBe('TestResource');
      expect(result.inscriptionId).toBeString();
      expect(result.inscriptionId).toStartWith('mock-inscription-');
      expect(result.contentType).toBe('application/json');
      expect(result.content).toEqual({
        ...resourceData
      });
      
      // Should log the created resource
      expect(consoleOutput.some(log => log.includes('Created linked resource:'))).toBe(true);
    });

    it('should include didReference in content when provided', async () => {
      // Arrange
      const resourceData = {
        type: 'TestResource',
        name: 'Test Resource'
      };
      const didReference = 'did:btco:1939534441773337';

      // Act
      const result = await createLinkedResource(resourceData, didReference);

      // Assert
      expect(result).toBeDefined();
      expect(result.didReference).toBe(didReference);
      expect(result.content).toHaveProperty('didReference', didReference);
    });

    it('should throw an error if type is missing', async () => {
      // Arrange
      const resourceData = {
        name: 'Test Resource Without Type'
      };

      // Act & Assert
      await expect(createLinkedResource(resourceData)).rejects.toThrow('Resource must have a type property');
      expect(consoleOutput.some(log => log.includes('ERROR: Error creating linked resource:'))).toBe(true);
    });

    it('should handle different types of resource data', async () => {
      // Arrange
      const resourceData = {
        type: 'ComplexResource',
        name: 'Complex Resource',
        properties: {
          nested: {
            value: 123
          },
          array: [1, 2, 3]
        }
      };

      // Act
      const result = await createLinkedResource(resourceData);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toEqual(resourceData);
    });
  });

  describe('getResourceByDid', () => {
    it('should return a mock resource for a valid DID', async () => {
      // Arrange
      const didId = 'did:btco:1026461333159039';

      // Act
      const result = await getResourceByDid(didId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(didId);
      expect(result?.type).toBe('Resource');
      expect(result?.didReference).toBe(didId);
      expect(result?.inscriptionId).toBeString();
      expect(result?.contentType).toBe('application/json');
      expect(result?.content).toHaveProperty('id', didId);
    });

    it('should throw an error for an invalid DID format', async () => {
      // Arrange
      const invalidDid = 'invalid-did-format';

      // Act
      const result = await getResourceByDid(invalidDid);

      // Assert
      expect(result).toBeNull();
      expect(consoleOutput.some(log => 
        log.includes(`ERROR: Error retrieving resource for DID ${invalidDid}:`) &&
        log.includes('Invalid DID format')
      )).toBe(true);
    });

    it('should validate that DIDs start with did:btco:', async () => {
      // Arrange
      const almostValidDid = 'did:eth:0x123'; // Valid DID but wrong method

      // Act
      const result = await getResourceByDid(almostValidDid);

      // Assert
      expect(result).toBeNull();
      expect(consoleOutput.some(log => log.includes('Invalid DID format'))).toBe(true);
    });
  });
}); 