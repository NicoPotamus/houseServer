import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import yaml from 'yaml';
// Fix for ES module: Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.BASE_URL;
const CLOUDFLARED_DIR = path.join(__dirname, '../cloudflaredConf');
console.log(`CLOUDFLARED_DIR: ${CLOUDFLARED_DIR}`);
export async function setupTunnel() {
    try {
        // Ensure cloudflared directory exists
        if (!fs.existsSync(CLOUDFLARED_DIR)) {
            fs.mkdirSync(CLOUDFLARED_DIR, { recursive: true });
        }
        // Get tunnel configuration from API
        console.log('Fetching tunnel configuration...');
        const response = await fetch(`${BASE_URL}/api/tunnel/provision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tunnelData = (await response.json());
        if (!tunnelData.success) {
            throw new Error('Failed to get tunnel configuration');
        }
        console.log('Tunnel configuration fetched successfully:', tunnelData);
        // Parse the YAML to modify it
        const config = yaml.parse(tunnelData.data.configYml);
        // Update the config
        config['credentials-file'] = '/etc/cloudflared/tunnel.json';
        config.ingress[0].service = 'http://house-server:3000';
        // Add additional configuration
        config.protocol = 'http2';
        config['retry-without-auth'] = true;
        config['no-autoupdate'] = true;
        config['transport-loglevel'] = 'info';
        config['protocol-loglevel'] = 'info';
        // Write the modified config
        const configPath = path.join(CLOUDFLARED_DIR, 'config.yml');
        fs.writeFileSync(configPath, yaml.stringify(config));
        console.log('Generated config.yml');
        // Decode and write tunnel credentials
        const tunnelJsonPath = path.join(CLOUDFLARED_DIR, 'tunnel.json');
        const credentialsBuffer = Buffer.from(tunnelData.data.tunnelJsonBase64, 'base64');
        console.log('json content:', credentialsBuffer.toString('utf8'));
        fs.writeFileSync(tunnelJsonPath, credentialsBuffer);
        console.log('Generated tunnel.json');
        // Log the directory's contents
        const files = fs.readdirSync(CLOUDFLARED_DIR);
        console.log('Files in CLOUDFLARED_DIR:', files);
        console.log('Tunnel setup completed successfully');
    }
    catch (error) {
        console.error('Error setting up tunnel:', error);
        throw error;
    }
}
