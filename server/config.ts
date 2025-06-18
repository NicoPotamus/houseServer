import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Export to ensure dotenv is initialized before other modules
export {};
