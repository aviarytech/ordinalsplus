# ordinals-plus-api

API for the Ordinals Plus Explorer, providing endpoints for Ordinals DIDs and linked resources on the Bitcoin blockchain.

To install dependencies:

```bash
bun install
```

Create a `.env` file using the example:

```bash
cp .env.example .env
```

Update the variables before running tests.

## API Endpoints

- `/status` - API health check
- `/api/ord/status` - Check Ord node status and availability
- `/api/resources` - Get all resources with pagination
- `/api/resources/:id` - Get a specific resource by ID
- `/api/resources/did/:didId` - Get resources associated with a specific DID
- `/api/resources/:id/content` - Get direct content from a resource
- `/api/explore` - Legacy endpoint for exploring DIDs (deprecated)

This project was created using `bun init` in bun v1.2.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
