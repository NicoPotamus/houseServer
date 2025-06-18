import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import yaml from 'yaml';
import '../config.ts';
const BASE_URL = process.env.BASE_URL;
const CLOUDFLARED_DIR = path.join(process.cwd(), '..', 'cloudflaredConf');
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
        fs.writeFileSync(tunnelJsonPath, credentialsBuffer);
        console.log('Generated tunnel.json');
        console.log('Tunnel setup completed successfully');
    }
    catch (error) {
        console.error('Error setting up tunnel:', error);
        throw error;
    }
}
