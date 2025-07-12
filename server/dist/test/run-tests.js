#!/usr/bin/env node
/**
 * WebRTC Test Runner Script
 * Run this script to test your WebRTC server functionality
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};
function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}
console.log(colorize('🚀 WebRTC Server Test Runner', 'cyan'));
console.log(colorize('================================', 'cyan'));
// Check if we're in the correct directory
const currentDir = process.cwd();
const serverDir = path.join(currentDir);
const packageJsonPath = path.join(serverDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.error(colorize('❌ Error: package.json not found. Please run this script from the server directory.', 'red'));
    process.exit(1);
}
console.log(colorize(`📁 Server directory: ${serverDir}`, 'blue'));
// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'all';
console.log(colorize(`🧪 Test type: ${testType}`, 'yellow'));
console.log('');
try {
    switch (testType) {
        case 'build':
            console.log(colorize('🔨 Building TypeScript...', 'yellow'));
            execSync('npm run build', { stdio: 'inherit', cwd: serverDir });
            console.log(colorize('✅ Build completed successfully', 'green'));
            break;
        case 'unit':
            console.log(colorize('🧪 Running unit tests...', 'yellow'));
            // Run the WebRTC test suite
            const testPath = path.join(serverDir, 'dist', 'test', 'webrtc-test.js');
            if (fs.existsSync(testPath)) {
                execSync(`node ${testPath}`, { stdio: 'inherit', cwd: serverDir });
            }
            else {
                console.log(colorize('⚠️ Test file not found, building first...', 'yellow'));
                execSync('npm run build', { stdio: 'inherit', cwd: serverDir });
                execSync(`node ${testPath}`, { stdio: 'inherit', cwd: serverDir });
            }
            break;
        case 'server':
            console.log(colorize('🖥️ Testing server endpoints...', 'yellow'));
            // Check if server is running
            try {
                const { default: fetch } = await import('node-fetch');
                const response = await fetch('http://localhost:3000/test/health');
                if (response.ok) {
                    console.log(colorize('✅ Server is running and responsive', 'green'));
                    // Test various endpoints
                    const endpoints = [
                        '/files',
                        '/test/status',
                        '/test/signaler',
                        '/test/performance'
                    ];
                    for (const endpoint of endpoints) {
                        try {
                            const testResponse = await fetch(`http://localhost:3000${endpoint}`);
                            if (testResponse.ok) {
                                console.log(colorize(`✅ ${endpoint} - OK`, 'green'));
                            }
                            else {
                                console.log(colorize(`❌ ${endpoint} - ${testResponse.status} ${testResponse.statusText}`, 'red'));
                            }
                        }
                        catch (e) {
                            console.log(colorize(`❌ ${endpoint} - Connection failed`, 'red'));
                        }
                    }
                }
                else {
                    throw new Error('Server not responding');
                }
            }
            catch (error) {
                console.log(colorize('❌ Server is not running or not accessible at http://localhost:3000', 'red'));
                console.log(colorize('💡 Start the server with: npm start', 'yellow'));
            }
            break;
        case 'docker':
            console.log(colorize('🐳 Testing Docker setup...', 'yellow'));
            try {
                // Check if Docker is running
                execSync('docker --version', { stdio: 'pipe' });
                console.log(colorize('✅ Docker is available', 'green'));
                // Check if containers are running
                const containers = execSync('docker ps --format "table {{.Names}}\\t{{.Status}}"', { encoding: 'utf8' });
                console.log(colorize('📋 Running containers:', 'blue'));
                console.log(containers);
                // Check specific containers
                const expectedContainers = ['house-server', 'house-signaler', 'house-db'];
                for (const container of expectedContainers) {
                    if (containers.includes(container)) {
                        console.log(colorize(`✅ ${container} - Running`, 'green'));
                    }
                    else {
                        console.log(colorize(`❌ ${container} - Not running`, 'red'));
                    }
                }
            }
            catch (error) {
                console.log(colorize('❌ Docker is not available or containers are not running', 'red'));
                console.log(colorize('💡 Start containers with: docker-compose up -d', 'yellow'));
            }
            break;
        case 'interactive':
            console.log(colorize('🌐 Starting interactive test...', 'yellow'));
            console.log(colorize('💡 Open your browser to: http://localhost:3000/test', 'cyan'));
            console.log(colorize('🔧 Use the web interface to test WebRTC functionality', 'blue'));
            // Check if server is running, if not suggest starting it
            try {
                const { default: fetch } = await import('node-fetch');
                await fetch('http://localhost:3000/test/health');
                console.log(colorize('✅ Test interface should be available now', 'green'));
            }
            catch (error) {
                console.log(colorize('⚠️ Server might not be running. Start it with: npm start', 'yellow'));
            }
            break;
        case 'all':
        default:
            console.log(colorize('🔄 Running comprehensive test suite...', 'yellow'));
            // 1. Build
            console.log(colorize('\n1️⃣ Building project...', 'magenta'));
            execSync('npm run build', { stdio: 'inherit', cwd: serverDir });
            // 2. Check Docker
            console.log(colorize('\n2️⃣ Checking Docker setup...', 'magenta'));
            try {
                const containers = execSync('docker ps --filter "name=house-" --format "{{.Names}}"', { encoding: 'utf8' });
                if (containers.trim()) {
                    console.log(colorize('✅ Docker containers are running', 'green'));
                }
                else {
                    console.log(colorize('⚠️ No house-* containers found running', 'yellow'));
                }
            }
            catch (e) {
                console.log(colorize('⚠️ Docker check skipped (Docker not available)', 'yellow'));
            }
            // 3. Run unit tests
            console.log(colorize('\n3️⃣ Running WebRTC tests...', 'magenta'));
            try {
                const testPath = path.join(serverDir, 'dist', 'test', 'webrtc-test.js');
                if (fs.existsSync(testPath)) {
                    execSync(`node ${testPath}`, { stdio: 'inherit', cwd: serverDir });
                }
                else {
                    console.log(colorize('⚠️ WebRTC test file not found, skipping unit tests', 'yellow'));
                }
            }
            catch (e) {
                console.log(colorize('❌ Unit tests failed', 'red'));
            }
            // 4. Test server endpoints
            console.log(colorize('\n4️⃣ Testing server endpoints...', 'magenta'));
            try {
                const { default: fetch } = await import('node-fetch');
                const response = await fetch('http://localhost:3000/test/health');
                if (response.ok) {
                    console.log(colorize('✅ Server endpoints are accessible', 'green'));
                }
                else {
                    console.log(colorize('❌ Server endpoints not accessible', 'red'));
                }
            }
            catch (e) {
                console.log(colorize('❌ Server is not running', 'red'));
            }
            console.log(colorize('\n✨ Test suite completed!', 'cyan'));
            console.log(colorize('💡 For interactive testing, run: npm run test:interactive', 'blue'));
            break;
    }
}
catch (error) {
    console.error(colorize(`❌ Test failed: ${error}`, 'red'));
    process.exit(1);
}
console.log(colorize('\n🎉 All tests completed!', 'green'));
