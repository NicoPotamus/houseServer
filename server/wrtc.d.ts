declare module 'wrtc' {
  export class RTCPeerConnection {
    constructor(configuration?: RTCConfiguration);
    onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
    onconnectionstatechange: (() => void) | null;
    connectionState: string;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    createAnswer(): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
    close(): void;
  }

  export class RTCSessionDescription {
    constructor(descriptionInitDict: RTCSessionDescriptionInit);
  }

  export class RTCIceCandidate {
    constructor(candidateInitDict: RTCIceCandidateInit);
  }
}
