# WebRTC Setup Guide for HouseClient

## What's happening?

You're seeing the "WebRTC is not supported in this browser" error because WebRTC (Web Real-Time Communication) requires native platform support that isn't available in the standard Expo development environment.

## The Solution: Development Build

For React Native apps that use WebRTC, you need to create a **development build** instead of using Expo Go.

### For Android:
```bash
npx expo run:android
```

### For iOS:
```bash
npx expo run:ios
```

## What this does:

1. **Creates a custom native app** with WebRTC support
2. **Installs the app on your device/emulator** 
3. **Enables full WebRTC functionality** for real-time communication

## Current Status:

- ✅ **react-native-webrtc** package is installed
- ✅ **@config-plugins/react-native-webrtc** plugin is configured
- ✅ **Metro and Babel configs** are set up
- ✅ **App permissions** for camera/microphone are configured
- ⏳ **Development build** needed to run WebRTC

## Testing WebRTC:

Once you create the development build:

1. **Navigate to the WebRTC Test page** (`/webrtc-test`)
2. **Connect to the signaler** (should be running on localhost:8080)
3. **Connect to the server** (should be running on localhost:3000)
4. **Send test data** through the WebRTC data channel

## Alternative: Web Testing

If you want to test WebRTC immediately:

1. **Run the web version**: `npm run web`
2. **Open in a modern browser** (Chrome, Firefox, Safari, Edge)
3. **WebRTC will work natively** in the browser environment

## Architecture:

```
[Client App] <--WebSocket--> [Signaler:8080] <--WebSocket--> [Server:3000]
     |                                                           |
     +------------------WebRTC Data Channel-------------------+
```

The signaler facilitates the initial WebRTC handshake, then direct peer-to-peer communication is established between client and server.
