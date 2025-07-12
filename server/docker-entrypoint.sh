#!/bin/sh

set -e

echo "Waiting for signaler to be fully ready before starting server..."
# Wait for signaler health endpoint to be available
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]
do
    if wget -q --spider http://house-signaler:8080/health; then
        echo "Signaler service is ready!"
        break
    fi
    
    attempt=$((attempt+1))
    echo "Waiting for signaler service... attempt $attempt/$max_attempts"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "Signaler service not available after $max_attempts attempts. Starting anyway, but expect connection issues..."
fi

echo "Checking TypeScript build output..."
# Check if the WebRTC API module exists
if [ -f "/usr/src/app/dist/controller/webrtcAPI.js" ]; then
    echo "WebRTC API module found! Build looks good."
else
    echo "WARNING: WebRTC API module not found. Rebuilding TypeScript..."
    cd /usr/src/app && npm run rebuild
    
    # Check again after rebuild
    if [ -f "/usr/src/app/dist/controller/webrtcAPI.js" ]; then
        echo "WebRTC API module successfully rebuilt."
    else
        echo "ERROR: Could not build WebRTC API module. API requests via WebRTC may fail."
    fi
fi

echo "Starting server now..."
# Execute the original Docker CMD
exec "$@"
