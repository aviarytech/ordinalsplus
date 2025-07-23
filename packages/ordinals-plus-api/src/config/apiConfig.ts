import { Elysia, NotFoundError, ValidationError, ParseError } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { InscriptionNotFoundError } from '../services/inscriptionService';
import type { ErrorResponse } from '../types';
import { env } from './envConfig';

// Define API configuration
export const PORT = env.PORT;
export const HOST = env.HOST ?? '0.0.0.0';
export const API_BASE_URL = env.API_BASE_URL || `http://localhost:${PORT}`;

// Constants for the API
export const MIN_DUST = 546; // Sats
export const POSTAGE_VALUE = 1000; // Sats for the inscription output value

// Configure base API instance with middleware
export const configureApi = () => {
    const app = new Elysia()
        // --- Basic Setup ---
        .use(cors())
        .use(swagger({
            path: '/docs',
            documentation: {
                info: {
                    title: 'Ordinals Plus API',
                    version: '1.0.0',
                    description: 'API for managing and exploring Ordinals-based DIDs and linked resources.'
                }
            }
        }))
        // --- Global Error Handler ---
        .onError(({ code, error, set }) => {
            let message = 'Internal Server Error';
            let status = 500;
            let details: any = undefined;

            console.error(`[${code}] Error caught:`, error); // Log the raw error first

            // Handle specific Elysia errors
            if (error instanceof NotFoundError) {
                message = error.message || 'Resource not found'; // Use message from error if available
                status = 404;
            } else if (error instanceof ValidationError) {
                message = 'Validation failed';
                status = 400;
                // Attempt to extract meaningful details from validation error
                details = error.all ?? error.message; 
            } else if (error instanceof ParseError) {
                message = 'Failed to parse request body';
                status = 400;
                details = error.message;
            } 
            // Handle custom application errors
            else if (error instanceof InscriptionNotFoundError) {
                message = error.message || 'Inscription not found';
                status = 404;
            } 
            // Handle generic JS Errors
            else if (error instanceof Error) {
                message = error.message || 'An unexpected error occurred';
                // Keep status 500 unless it's a re-thrown known error
            } 
            // Handle non-standard errors/objects thrown
            else {
                message = 'An unknown error occurred';
                details = String(error); // Convert the thrown value to string
            }

            console.error(`Responding with status ${status}: ${message}`, details ? `| Details: ${JSON.stringify(details)}` : '');

            set.status = status;
            // Ensure response conforms to a basic error shape
            const responseBody: ErrorResponse = { error: message };
            if (details !== undefined) {
                responseBody.details = details;
            }
            return responseBody; 
        });

    return app;
}; 