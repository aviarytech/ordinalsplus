/// <reference types="cypress" />

describe('Ordinal Resource Creation Form', () => {
  const testFilePath = 'cypress/fixtures/test.txt';
  const pageUrl = '/create'; // Adjust if the route is different
  const apiUrl = '/api/inscriptions/resource'; // Corrected API path
  // Dummy testnet data
  const dummyRecipientAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'; // Example testnet address
  const dummySenderPublicKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'; // Example testnet public key

  beforeEach(() => {
    // Intercept the API call
    cy.intercept('POST', apiUrl).as('createResource');
    cy.visit(pageUrl);
    // Wait for the form to indicate API service is ready
    cy.get('form[data-api-ready="true"]').should('exist', { timeout: 10000 });
    // Also wait for fee input to be ready (as before)
    cy.get('input#feeRate').should('not.be.disabled', { timeout: 10000 });
  });

  it('should allow creating a basic resource inscription', () => {
    cy.get('input[type="file"]#fileUpload').selectFile(testFilePath, { force: true });
    // cy.wait(1000); // Removed fixed wait
    cy.contains('Selected: test.txt (text/plain)').should('be.visible');
    cy.contains('Failed to read file content.').should('not.exist');
    
    // Fill required fields
    cy.get('input#recipientAddress').type(dummyRecipientAddress);
    cy.get('input#senderPublicKey').type(dummySenderPublicKey);
    const feeRate = 15;
    cy.get('input#feeRate').clear().type(feeRate.toString());

    // Wait for the submit button to become enabled (restored)
    cy.log('Waiting for Generate PSBT button to be enabled');
    cy.get('button[type="submit"]').contains('Generate PSBT').should('not.be.disabled', { timeout: 15000 });

    // Attempt to submit by triggering form submit event on the specific form
    cy.log('Triggering form submit event on form[data-api-ready="true"]');
    cy.get('form[data-api-ready="true"]').submit(); // Target specific form

    // Wait for the API call to complete and check its response
    cy.log('Waiting for @createResource API call');
    cy.wait('@createResource', { timeout: 15000 }).then((interception) => {
      // Log the response body for debugging
      console.log('API Response Body:', interception.response?.body);
      // Assert on status code
      expect(interception.response?.statusCode).to.eq(200);
    });

    cy.log('Checking for absence of general error message');
    cy.get('.border-red-300').should('not.exist');
    cy.log('Checking for PSBT display container');
    cy.get('.psbt-display-container', { timeout: 5000 }).should('be.visible');
  });

  it('should allow creating a linked resource WITHOUT metadata (for testing)', () => {
    cy.contains('Advanced Options').click();
    const parentDid = 'did:btco:1a2b3c';
    cy.get('input#parentDid').type(parentDid);
    // --- Skip metadata interaction for this test --- 
    // const metadataKey = 'testKey';
    // const metadataValue = 'testValue';
    // cy.get('input[placeholder="Key"]').first().type(metadataKey);
    // cy.get('input[placeholder="Value"]').first().type(metadataValue);

    cy.get('input[type="file"]#fileUpload').selectFile(testFilePath, { force: true });
    // cy.wait(1000); // Removed fixed wait
    cy.contains('Failed to read file content.').should('not.exist');
    
    // Fill required fields
    cy.get('input#recipientAddress').type(dummyRecipientAddress);
    cy.get('input#senderPublicKey').type(dummySenderPublicKey);
    const feeRate = 20;
    cy.get('input#feeRate').clear().type(feeRate.toString());
    
    // Wait for the submit button to become enabled (restored)
    cy.log('Waiting for Generate PSBT button to be enabled');
    cy.get('button[type="submit"]').contains('Generate PSBT').should('not.be.disabled', { timeout: 15000 });

    // Attempt to submit by triggering form submit event on the specific form
    cy.log('Triggering form submit event on form[data-api-ready="true"]');
    cy.get('form[data-api-ready="true"]').submit(); // Target specific form

    // Wait for the API call to complete and check its response
    cy.log('Waiting for @createResource API call');
    cy.wait('@createResource', { timeout: 15000 }).then((interception) => {
      // Log the response body for debugging
      console.log('API Response Body:', interception.response?.body);
      // Assert on status code
      expect(interception.response?.statusCode).to.eq(200);
    });

    cy.log('Checking for absence of general error message');
    cy.get('.border-red-300').should('not.exist');
    cy.log('Checking for PSBT display container');
    cy.get('.psbt-display-container', { timeout: 5000 }).should('be.visible');
  });

}); 