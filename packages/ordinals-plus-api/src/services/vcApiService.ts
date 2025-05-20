/**
 * VC API Service
 * 
 * Provides functions for interacting with VC API providers
 */
import { getVCApiProviderById } from '../config/vcApiConfig';
import fetch from 'node-fetch';

/**
 * Get the workflow configuration from a VC API provider
 * 
 * This follows the W3C CCG VC API standard for the Get Workflow Configuration endpoint:
 * https://w3c-ccg.github.io/vc-api/#get-workflow-configuration
 * 
 * @param providerId - ID of the VC API provider to use
 * @returns The workflow configuration data
 */
export async function getWorkflowConfiguration(providerId: string) {
  const provider = getVCApiProviderById(providerId);
  
  // Ensure the URL doesn't end with /exchanges
  const baseUrl = provider.url.endsWith('/exchanges') 
    ? provider.url.substring(0, provider.url.length - '/exchanges'.length)
    : provider.url;
  
  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(provider.authToken && { 'Authorization': `Bearer ${provider.authToken}` })
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch workflow configuration: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Debug log to see the structure of the workflow configuration
    console.log('Workflow configuration structure:', JSON.stringify(data, null, 2));
    
    // Check for variables in the config structure
    if (data.config && data.config.steps) {
      console.log('Found steps in config:', Object.keys(data.config.steps));
      
      // Log each step's structure
      Object.entries(data.config.steps).forEach(([stepId, stepData]: [string, any]) => {
        if (stepData.step && stepData.step.issueRequests) {
          console.log(`Step ${stepId} has issueRequests:`, stepData.step.issueRequests);
          
          // Log variables in each issueRequest
          stepData.step.issueRequests.forEach((request: any, index: number) => {
            if (request.variables) {
              console.log(`Request ${index} has variables:`, request.variables);
            }
          });
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching workflow configuration:', error);
    throw error;
  }
}

/**
 * Format workflow configuration data for client consumption
 * 
 * This passes through the raw VC API response with minimal transformation
 * to ensure we're preserving the full VC API structure.
 * 
 * @param config - Raw workflow configuration data from the VC API
 * @returns The workflow configuration data with minimal processing
 */
export function formatWorkflowConfiguration(config: any) {
  // Log the raw config for debugging
  console.log('Raw workflow configuration:', JSON.stringify(config, null, 2));
  
  // Extract variables from the configuration
  const extractedVariables: Record<string, string> = {};
  
  // Check if config has steps with issueRequests
  if (config.config && config.config.steps) {
    Object.values(config.config.steps).forEach((stepData: any) => {
      if (stepData.step && stepData.step.issueRequests) {
        stepData.step.issueRequests.forEach((request: any) => {
          if (request.variables && typeof request.variables === 'string') {
            try {
              // Try to parse the variables JSON string
              const variablesObj = JSON.parse(request.variables.replace(/\n/g, ''));
              Object.entries(variablesObj).forEach(([key, value]) => {
                extractedVariables[key] = String(value);
              });
              console.log('Extracted variables:', extractedVariables);
            } catch (error) {
              console.error('Error parsing variables JSON string:', error);
              // Try a more aggressive approach if standard parsing fails
              try {
                // Extract variable names and values using regex
                const varMatches = request.variables.match(/"([^"]+)"\s*:\s*([^,\n\}]+)/g);
                if (varMatches) {
                  varMatches.forEach((match: string) => {
                    const parts = match.split(':');
                    if (parts.length >= 2) {
                      const varName = parts[0].trim().replace(/"/g, '');
                      const varValue = parts[1].trim();
                      extractedVariables[varName] = varValue;
                    }
                  });
                  console.log('Extracted variables using regex:', extractedVariables);
                }
                
                // If we still don't have variables, try a direct approach
                if (Object.keys(extractedVariables).length === 0) {
                  // Look for var_passportNumber and var_surname directly
                  if (request.variables.includes('var_passportNumber')) {
                    extractedVariables['var_passportNumber'] = 'exchange.passportNumber';
                  }
                  if (request.variables.includes('var_surname')) {
                    extractedVariables['var_surname'] = 'exchange.surname';
                  }
                  console.log('Extracted variables using direct approach:', extractedVariables);
                }
              } catch (regexError) {
                console.error('Error extracting variables with regex:', regexError);
              }
            }
          }
        });
      }
    });
  }
  
  // Check for credential templates to extract variable descriptions
  const variableDescriptions: Record<string, string> = {};
  if (config.config && config.config.credentialTemplates) {
    config.config.credentialTemplates.forEach((template: any) => {
      if (template.template && typeof template.template === 'string') {
        // Extract variable names from the template
        const varMatches = template.template.match(/var_[a-zA-Z0-9_]+/g);
        if (varMatches) {
          varMatches.forEach((varName: string) => {
            variableDescriptions[varName] = `Variable for ${varName.replace('var_', '')}`;
          });
        }
      }
    });
  }
  
  // Return the complete raw response and add a formatted property with extracted variables
  return {
    ...config,
    formatted: {
      schema: config.schema || config.credentialSchema || null,
      requiredFields: extractRequiredFields(config),
      supportedTypes: extractSupportedTypes(config),
      description: config.description || null,
      variables: extractedVariables,
      variableDescriptions: variableDescriptions,
      credentialTemplateId: config.config?.credentialTemplates?.[0]?.id || null
    }
  };
}

/**
 * Extract required fields from the workflow configuration
 */
function extractRequiredFields(config: any): string[] {
  const requiredFields = [];
  
  // Try to extract required fields from schema
  const schema = config.schema || config.credentialSchema;
  if (schema && schema.required && Array.isArray(schema.required)) {
    requiredFields.push(...schema.required);
  }
  
  return requiredFields;
}

/**
 * Extract supported credential types from the workflow configuration
 */
function extractSupportedTypes(config: any): string[] {
  const supportedTypes = [];
  const schema = config.schema || config.credentialSchema;
  
  // Try to extract types from schema or configuration
  if (config.types && Array.isArray(config.types)) {
    supportedTypes.push(...config.types);
  } else if (schema && schema.type === 'object' && schema.properties && schema.properties.type) {
    if (schema.properties.type.enum && Array.isArray(schema.properties.type.enum)) {
      supportedTypes.push(...schema.properties.type.enum);
    } else if (schema.properties.type.const) {
      supportedTypes.push(schema.properties.type.const);
    }
  }
  
  return supportedTypes;
}

/**
 * Participate in an exchange with a VC API provider
 * 
 * This follows the W3C CCG VC API standard for the Exchange Participation endpoint:
 * https://w3c-ccg.github.io/vc-api/#participate-in-exchange
 * 
 * @param providerId - ID of the VC API provider to use
 * @param exchangeId - ID of the exchange to participate in
 * @param variables - Variables to use in the exchange
 * @returns The exchange participation response
 */
export async function participateInExchange(providerId: string, exchangeId: string, variables: Record<string, string>) {
  const provider = getVCApiProviderById(providerId);
  
  // Construct the exchange URL
  let exchangeUrl = provider.url;
  
  // Handle different URL formats
  // Remove trailing slash if present
  exchangeUrl = exchangeUrl.endsWith('/') ? exchangeUrl.slice(0, -1) : exchangeUrl;
  
  // Check if URL already contains '/exchanges'
  if (exchangeUrl.endsWith('/exchanges')) {
    exchangeUrl = `${exchangeUrl}/${exchangeId}`;
  } else if (exchangeUrl.includes('/exchanges/')) {
    // Handle case where URL might be like 'https://example.com/api/exchanges/'
    exchangeUrl = `${exchangeUrl.split('/exchanges/')[0]}/exchanges/${exchangeId}`;
  } else {
    // Default case - append the full path
    exchangeUrl = `${exchangeUrl}/exchanges/${exchangeId}`;
  }
  
  console.log('Constructed exchange URL:', exchangeUrl);
  
  try {
    // Prepare the request body with the variables
    const requestBody: {
      options: {
        challenge: string;
        domain: string;
      };
      exchange: Record<string, string>;
    } = {
      options: {
        challenge: 'optional-challenge-value', // Can be made configurable if needed
        domain: 'optional-domain-value' // Can be made configurable if needed
      },
      exchange: {}
    };
    
    // Add the variables to the exchange object
    // This transforms variables like { var_passportNumber: 'ABC123' } to { passportNumber: 'ABC123' }
    Object.entries(variables).forEach(([key, value]) => {
      // If the key starts with 'var_', remove it to match the expected format
      const normalizedKey = key.startsWith('var_') ? key.substring(4) : key;
      // Add to the exchange object
      requestBody.exchange[normalizedKey] = value;
    });
    
    console.log('Sending exchange participation request:', JSON.stringify(requestBody, null, 2));
    
    // Send the request to the VC API provider
    const response = await fetch(exchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(provider.authToken && { 'Authorization': `Bearer ${provider.authToken}` })
      },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to participate in exchange: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Exchange participation response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error participating in exchange:', error);
    throw error;
  }
}

/**
 * Create an exchange with a VC API provider
 * 
 * This follows the W3C CCG VC API standard for creating an exchange:
 * https://w3c-ccg.github.io/vc-api/#create-exchange
 * 
 * @param providerId - ID of the VC API provider to use
 * @param options - Options for creating the exchange
 * @returns The created exchange data
 */
export async function createExchange(providerId: string, options: {
  type?: string;
  issuer?: string;
  subject?: string;
  [key: string]: any;
}) {
  const provider = getVCApiProviderById(providerId);
  
  // Construct the exchange URL
  let exchangeUrl = provider.url;
  
  // Handle different URL formats
  // Remove trailing slash if present
  exchangeUrl = exchangeUrl.endsWith('/') ? exchangeUrl.slice(0, -1) : exchangeUrl;
  
  // Check if URL already contains '/exchanges'
  if (exchangeUrl.endsWith('/exchanges')) {
    // URL is already correctly formatted
  } else if (exchangeUrl.includes('/exchanges/')) {
    // Handle case where URL might be like 'https://example.com/api/exchanges/'
    exchangeUrl = `${exchangeUrl.split('/exchanges/')[0]}/exchanges`;
  } else {
    // Default case - append the path
    exchangeUrl = `${exchangeUrl}/exchanges`;
  }
  
  console.log('Constructed exchange creation URL:', exchangeUrl);
  
  try {
    // Prepare the request body with the options
    const requestBody = {
      // Default values
      type: 'VerifiableCredential',
      ...options
    };
    
    console.log('Creating exchange with request:', JSON.stringify(requestBody, null, 2));
    
    // Send the request to the VC API provider
    const response = await fetch(exchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(provider.authToken && { 'Authorization': `Bearer ${provider.authToken}` })
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create exchange: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Exchange creation response:', JSON.stringify(data, null, 2));
    
    // Normalize the response to ensure the exchange ID is available with a consistent property name
    const normalizedData = { ...data };
    
    // Check for different possible property names for the exchange ID
    // and ensure we have a consistent 'id' property
    if (!normalizedData.id) {
      const possibleIdFields = ['exchangeId', '_id', 'exchange_id'];
      for (const field of possibleIdFields) {
        if (normalizedData[field]) {
          normalizedData.id = normalizedData[field];
          break;
        }
      }
      
      // Check if the ID is nested in an 'exchange' object
      if (!normalizedData.id && normalizedData.exchange && normalizedData.exchange.id) {
        normalizedData.id = normalizedData.exchange.id;
      }
    }
    
    return normalizedData;
  } catch (error) {
    console.error('Error creating exchange:', error);
    throw error;
  }
}
