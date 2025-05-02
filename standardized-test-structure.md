# Standardized Test Structure

## Recommended Test File Organization

### Core Package (ordinalsplus)
- All tests in `/test` directory at project root
- Test files named `[feature-name].test.ts`
- Setup files in `/test/setup.ts` 
- Mock data in `/test/mocks/` directory

### API Project (ordinals-plus-api)
- Unit tests in `__tests__` directories adjacent to the code they test
  - Example: `src/services/__tests__/psbtService.test.ts` tests `src/services/psbtService.ts`
- Integration tests in `/src/integration-tests/`
- End-to-end tests in `/src/e2e-tests/`
- Test utilities in `/src/test-utils/`

### Frontend Project (ordinals-plus-explorer)
- Component tests in `__tests__` directories adjacent to components
- UI integration tests in `/src/integration-tests/`
- E2E tests in `/cypress/` (if using Cypress)

## Naming Conventions

- Unit test files: `[file-name].test.ts`
- Integration test files: `[feature-name].integration.test.ts`
- E2E test files: `[flow-name].e2e.test.ts`
- Test utilities: `[utility-purpose].utils.ts`

## Test Frameworks & Tools

- Core package: Jest
- API: Bun test
- Frontend: Vitest + Testing Library
- E2E: Playwright or Cypress

## Running Tests

Add standardized scripts to each package.json:

```json
"scripts": {
  "test": "bun test",
  "test:watch": "bun test --watch",
  "test:coverage": "bun test --coverage",
  "test:integration": "bun test src/integration-tests",
  "test:e2e": "bun test src/e2e-tests"
}
```

## Migration Plan

1. Create the required directory structure
2. Move existing test files to their new locations:
   - Move `/src/test-scripts/test-psbt-refactor.ts` to `/src/integration-tests/psbt-service.integration.test.ts`
   - Keep `/src/services/__tests__/psbtService.test.ts` where it is (already follows convention)
   - Move any standalone test utilities to `/src/test-utils/`

3. Update imports and references as needed
4. Add new test scripts to package.json
5. Update documentation to reference the new structure 