// loader.js - Used to load TypeScript files in ESM mode
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register .ts extension for ESM imports
register('ts-node/esm', pathToFileURL('./'));

// Run the actual application
import('./index.js');
