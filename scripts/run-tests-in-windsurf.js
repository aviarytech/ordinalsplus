#!/usr/bin/env node

/**
 * run-tests-in-windsurf.js
 * 
 * This script runs tests for all packages and presents a clean summary in the Windsurf interface.
 * It captures test output, parses the results, and displays them in a structured format.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

// Packages to test
const packages = [
  { name: 'ordinalsplus', dir: 'packages/ordinalsplus', command: 'bun test' },
  { name: 'ordinals-plus-api', dir: 'packages/ordinals-plus-api', command: 'bun test' },
  { name: 'ordinals-plus-explorer', dir: 'packages/ordinals-plus-explorer', command: 'vitest run' },
];

// Main function
async function runTests() {
  console.log('\n📦 Running tests for all packages\n');
  
  let allPassing = true;
  const results = [];
  
  for (const pkg of packages) {
    console.log(`\n${colors.bright}${colors.cyan}Testing ${pkg.name}...${colors.reset}\n`);
    
    try {
      // Run the tests and capture output
      const output = execSync(pkg.command, { 
        cwd: path.resolve(process.cwd(), pkg.dir),
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse test results
      const summary = parseTestResults(output, pkg.name);
      results.push(summary);
      
      // Display summary
      console.log(`${colors.green}✓ ${pkg.name} tests passed${colors.reset}`);
      console.log(`  Tests: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}`);
      
    } catch (error) {
      allPassing = false;
      console.log(`${colors.red}✗ ${pkg.name} tests failed${colors.reset}`);
      console.log(`  Error: ${error.message.split('\n')[0]}`);
      
      // Try to extract some useful information from the error output
      if (error.stdout) {
        const failedTests = extractFailedTests(error.stdout);
        if (failedTests.length > 0) {
          console.log(`  Failed tests:`);
          failedTests.forEach(test => console.log(`    - ${test}`));
        }
      }
      
      results.push({
        package: pkg.name,
        passed: false,
        error: error.message
      });
    }
  }
  
  // Display final summary
  console.log('\n=== Test Summary ===');
  results.forEach(result => {
    if (result.passed !== false) {
      console.log(`${colors.green}✓ ${result.package}${colors.reset}: ${result.passed}/${result.total} tests passed`);
    } else {
      console.log(`${colors.red}✗ ${result.package}${colors.reset}: tests failed`);
    }
  });
  
  if (allPassing) {
    console.log(`\n${colors.bgGreen}${colors.bright} All tests passed successfully! ${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bgRed}${colors.bright} Some tests failed! ${colors.reset}\n`);
    process.exit(1);
  }
}

// Parse test results from different test runners
function parseTestResults(output, packageName) {
  const result = {
    package: packageName,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // Different parsing logic based on the test runner
  if (packageName.includes('explorer')) {
    // Parse vitest output
    const passedMatch = output.match(/(\d+)\s+passed/i);
    const totalMatch = output.match(/(\d+)\s+tests/i);
    const failedMatch = output.match(/(\d+)\s+failed/i);
    const skippedMatch = output.match(/(\d+)\s+skipped/i);
    
    result.passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    result.total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    result.failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    result.skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
  } else {
    // Parse bun test output
    const summaryMatch = output.match(/(\d+)\s+pass(?:ed)?(?:ing)?[\s,]+(\d+)\s+fail(?:ed)?(?:ing)?(?:[\s,]+(\d+)\s+skip(?:ped)?(?:ing)?)?/i);
    
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[1], 10);
      result.failed = parseInt(summaryMatch[2], 10);
      result.skipped = summaryMatch[3] ? parseInt(summaryMatch[3], 10) : 0;
      result.total = result.passed + result.failed + result.skipped;
    } else {
      // Try alternative format
      const passedMatch = output.match(/(\d+)\s+pass(?:ed)?(?:ing)?/i);
      const failedMatch = output.match(/(\d+)\s+fail(?:ed)?(?:ing)?/i);
      const skippedMatch = output.match(/(\d+)\s+skip(?:ped)?(?:ing)?/i);
      const totalMatch = output.match(/(\d+)\s+tests?/i);
      
      result.passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
      result.failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
      result.skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
      result.total = totalMatch ? parseInt(totalMatch[1], 10) : (result.passed + result.failed + result.skipped);
    }
  }
  
  return result;
}

// Extract failed test names from error output
function extractFailedTests(output) {
  const failedTests = [];
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('✗') || line.includes('FAIL') || line.includes('failed')) {
      // Try to extract the test name
      const match = line.match(/[✗×]\s+(.+)$/);
      if (match) {
        failedTests.push(match[1].trim());
      }
    }
  }
  
  return failedTests.slice(0, 5); // Limit to 5 failed tests
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
