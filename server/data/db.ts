import { Pool } from 'pg';

const pool = new Pool({
    user: 'postgres',
    password: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'house_db',
    // Pool specific configuration
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// The pool will emit an error on behalf of any idle clients
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

export default pool;