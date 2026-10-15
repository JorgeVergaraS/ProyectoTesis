import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { DemoSessionStore } from '../auth/demo-session.store';
import { MediaDeviceService } from '../media/media-device.service';
import { VoiceCall, VoiceCallService } from './voice-call.service';

class FakePeer {
  static instances: FakePeer[] = [];
  static configs: RTCConfiguration[] = [];
  static initialGatheringState: RTCIceGatheringState = 'complete';
  connectionState = 'new';
  iceGatheringState = FakePeer.initialGatheringState;
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  videoSender = { replaceTrack: vi.fn(async () => undefined) };
  addTrack = vi.fn((track: MediaStreamTrack) =>
    track.kind === 'video' ? this.videoSender : { replaceTrack: vi.fn(async () => undefined) },
  );
  addTransceiver = vi.fn(() => ({ sender: this.videoSender }));
  addIceCandidate = vi.fn(async () => undefined);
  close = vi.fn();
  createOffer = vi.fn(async () => ({
    type: 'offer',
    sdp:
      this.addTransceiver.mock.calls.length > 0 ||
      this.addTrack.mock.calls.some(([track]) => track.kind === 'video')
        ? 'v=0\r\nm=audio offer\r\nm=video offer'
        : 'v=0\r\nm=audio offer',
  }));
  createAnswer = vi.fn(async () => ({
    type: 'answer',
    sdp:
      this.addTransceiver.mock.calls.length > 0 ||
      this.addTrack.mock.calls.some(([track]) => track.kind === 'video')
        ? 'v=0\r\nm=audio answer\r\nm=video answer'
        : 'v=0\r\nm=audio answer',
  }));
  async setLocalDescription(value: RTCSessionDescriptionInit) {
    this.localDescription = value;
  }
  async setRemoteDescription(value: RTCSessionDescriptionInit) {
    this.remoteDescription = value;
  }
  constructor(config?: RTCConfiguration) {
    FakePeer.instances.push(this);
    FakePeer.configs.push(config ?? {});
  }
}

class FakeMediaStream {
  private tracks: MediaStreamTrack[] = [];
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }
  addTrack(track: MediaStreamTrack) {
    if (!this.tracks.some((item) => item.id === track.id)) this.tracks.push(track);
  }
  removeTrack(track: MediaStreamTrack) {
    this.tracks = this.tracks.filter((item) => item.id !== track.id);
  }
}

describe('VoiceCallService', () => {
  let service: VoiceCallService;
  let server: VoiceCall | null;
  const token = signal<string | null>('demo-token');
  const kind = signal<'demo' | 'local' | 'microsoft'>('demo');
  const person = {
    id: 'jean',
    username: 'jean',
    displayName: 'Jean',
    color: '#fff',
    bio: '',
    online: true,
  };
  const currentUser = signal({ ...person, id: 'jorge' });
  const track = { enabled: true, stop: vi.fn() };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn();
  const http = { get: vi.fn(), post: vi.fn() };
  const studioStream = signal<MediaStream | null>(null);

  beforeEach(async () => {
    vi.useFakeTimers();
    FakePeer.instances = [];
    FakePeer.configs = [];
    FakePeer.initialGatheringState = 'complete';
    token.set('demo-token');
    kind.set('demo');
    currentUser.set({ ...person, id: 'jorge' });
    studioStream.set(null);
    track.enabled = true;
    track.stop.mockClear();
    server = null;
    getUserMedia.mockReset().mockResolvedValue(stream);
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    vi.stubGlobal('MediaStream', FakeMediaStream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    http.get.mockReset().mockImplementation(() => of(server));
    http.post.mockReset().mockImplementation((url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/calls')) {
        server = {
          id: String(body['id']),
          peer: person,
          outgoing: true,
          status: 'RINGING',
          reason: null,
          offer: null,
          answer: null,
          connectedAt: null,
          conversationId: null,
          video: body['video'] === true,
          candidates: [],
        };
      } else if (server && url.endsWith('/accept')) server = { ...server, status: 'CONNECTING' };
      else if (server && url.endsWith('/answer'))
        server = { ...server, answer: String(body['answer']) };
      else if (server && url.endsWith('/candidates')) return of(server);
      else if (server && (url.endsWith('/end') || url.endsWith('/reject')))
        server = { ...server, status: 'ENDED' };
      return of(server);
    });
    TestBed.configureTestingModule({
      providers: [
        VoiceCallService,
        { provide: HttpClient, useValue: http },
        { provide: DemoSessionStore, useValue: { token, kind, user: currentUser } },
        { provide: MediaDeviceService, useValue: { stream: studioStream } },
      ],
    });
    service = TestBed.inject(VoiceCallService);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('negotiates an outgoing call, applies its answer, mutes and releases media on hangup', async () => {
    await service.start(person);
    const peer = FakePeer.instances[0];
    expect(service.call()?.status).toBe('RINGING');
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });
    expect(peer.addTrack).toHaveBeenCalledWith(track, stream);
    const remoteCandidate = {
      candidate: 'candidate:2 1 UDP 2122260223 192.0.2.3 50001 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };
    server = {
      ...server!,
      status: 'CONNECTING',
      answer: 'v=0\r\nm=audio remote',
      candidates: [remoteCandidate],
    };
    await vi.advanceTimersByTimeAsync(1500);
    expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: server.answer });
    expect(peer.addIceCandidate).toHaveBeenCalledWith(remoteCandidate);
    const remoteAudio = {
      id: 'remote-audio',
      kind: 'audio',
      onmute: null,
      onunmute: null,
      onended: null,
    } as unknown as MediaStreamTrack;
    peer.ontrack?.({ streams: [stream], track: remoteAudio });
    expect(service.remoteStream()?.getTracks()).toEqual([remoteAudio]);
    service.toggleMute();
    expect(track.enabled).toBe(false);
    peer.connectionState = 'connected';
    peer.onconnectionstatechange?.();
    await Promise.resolve();
    expect(service.connection()).toBe('connected');
    await service.hangUp();
    expect(track.stop).toHaveBeenCalled();
    expect(peer.close).toHaveBeenCalled();
    expect(service.remoteStream()).toBeNull();
    expect(service.call()).toBeNull();
    expect(http.post.mock.calls.some(([url]) => url.endsWith('/end'))).toBe(true);
  });

  it('merges separate remote audio and video track events and publishes the added video reactively', async () => {
    await service.start(person, 'direct-id', true);
    const peer = FakePeer.instances[0];
    const remoteAudio = {
      id: 'remote-audio',
      kind: 'audio',
      onmute: null,
      onunmute: null,
      onended: null,
    } as unknown as MediaStreamTrack;
    const remoteVideo = {
      id: 'remote-video',
      kind: 'video',
      onmute: null,
      onunmute: null,
      onended: null,
    } as unknown as MediaStreamTrack;

    peer.ontrack?.({ streams: [], track: remoteAudio });
    const audioOnlySnapshot = service.remoteStream();
    peer.ontrack?.({ streams: [], track: remoteVideo });

    expect(service.remoteStream()).not.toBe(audioOnlySnapshot);
    expect(service.remoteStream()?.getTracks()).toEqual([remoteAudio, remoteVideo]);
    expect(
      service
        .remoteStream()
        ?.getTracks()
        .some((remoteTrack) => remoteTrack.kind === 'video'),
    ).toBe(true);
    expect(service.remoteCameraEnabled()).toBe(true);
  });

  it('starts a video call with an explicit camera request and sends camera media', async () => {
    const cameraTrack = { kind: 'video', enabled: true, stop: vi.fn() };
    const videoStream = {
      getTracks: () => [track, cameraTrack],
      getAudioTracks: () => [track],
      getVideoTracks: () => [cameraTrack],
    } as unknown as MediaStream;
    getUserMedia.mockResolvedValue(videoStream);

    await service.start(person, 'direct-id', true);

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({ echoCancellation: true }),
        video: expect.any(Object),
      }),
    );
    expect(FakePeer.instances[0].addTrack).toHaveBeenCalledWith(cameraTrack, videoStream);
    expect(service.call()?.video).toBe(true);
    expect(service.cameraEnabled()).toBe(true);
    await service.hangUp();
    expect(cameraTrack.stop).toHaveBeenCalledOnce();
  });

  it('continues as audio when video-call camera permission is unavailable', async () => {
    getUserMedia
      .mockRejectedValueOnce(new DOMException('Camera blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(stream);

    await service.start(person, 'direct-id', true);

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(service.call()?.video).toBe(true);
    expect(service.cameraEnabled()).toBe(false);
    expect(service.notice()).toContain('solo con audio');
  });

  it('loads short-lived TURN settings for a signed-in demo session', async () => {
    http.get.mockImplementation((url: string) => {
      if (url.endsWith('/ice-config'))
        return of({
          iceServers: [
            {
              urls: ['turn:relay.example:3478?transport=udp'],
              username: 'expiry:user',
              credential: 'signed',
            },
          ],
        });
      return of(server);
    });

    await service.start(person);

    expect(http.get.mock.calls.some(([url]) => url === '/api/demo/calls/ice-config')).toBe(true);
    expect(service.turnAvailable()).toBe(true);
    expect(FakePeer.configs[0]?.iceServers).toEqual([
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: ['turn:relay.example:3478?transport=udp'],
        username: 'expiry:user',
        credential: 'signed',
      },
    ]);
  });

  it('rings without waiting for ICE gathering and trickles candidates to signaling', async () => {
    FakePeer.initialGatheringState = 'gathering';
    const starting = service.start(person);
    await starting;
    const peer = FakePeer.instances[0];

    expect(service.call()?.status).toBe('RINGING');
    expect(peer.onicecandidate).toBeTypeOf('function');
    peer.onicecandidate?.({
      candidate: {
        toJSON: () => ({
          candidate: 'candidate:1 1 UDP 2122260223 192.0.2.2 50000 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
        }),
      } as RTCIceCandidate,
    } as RTCPeerConnectionIceEvent);
    await vi.advanceTimersByTimeAsync(100);

    expect(
      http.post.mock.calls.some(
        ([url, body]) =>
          url.endsWith('/candidates') &&
          (body as { candidates: RTCIceCandidateInit[] }).candidates[0]?.candidate?.startsWith(
            'candidate:1',
          ),
      ),
    ).toBe(true);
  });

  it('ends an ICE negotiation that never connects instead of leaving the call pending', async () => {
    await service.start(person);
    const peer = FakePeer.instances[0];
    server = { ...server!, status: 'CONNECTING', answer: 'v=0\r\nm=audio remote' };

    await vi.advanceTimersByTimeAsync(1500);
    expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: server.answer });

    await vi.advanceTimersByTimeAsync(25000);

    expect(service.call()).toBeNull();
    expect(service.notice()).toContain('No se encontró una ruta de llamada');
    expect(peer.close).toHaveBeenCalled();
  });

  it('does not request a microphone for an incoming call until it is accepted', async () => {
    server = {
      id: 'incoming',
      peer: person,
      outgoing: false,
      status: 'RINGING',
      reason: null,
      offer: 'v=0\r\nm=audio remote',
      answer: null,
      connectedAt: null,
      conversationId: null,
      video: false,
    };
    await vi.advanceTimersByTimeAsync(1500);
    expect(getUserMedia).not.toHaveBeenCalled();
    await service.accept();
    expect(FakePeer.instances[0].remoteDescription?.type).toBe('offer');
    expect(
      http.post.mock.calls.some(
        ([url, body]) => url.endsWith('/answer') && String(body.answer).includes('audio'),
      ),
    ).toBe(true);
  });

  it('answers an incoming video call with the captured camera track attached to its SDP stream', async () => {
    const cameraTrack = { kind: 'video', enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
    const videoStream = {
      getTracks: () => [track, cameraTrack],
      getAudioTracks: () => [track],
      getVideoTracks: () => [cameraTrack],
    } as unknown as MediaStream;
    getUserMedia.mockResolvedValue(videoStream);
    server = {
      id: 'incoming-video',
      peer: person,
      outgoing: false,
      status: 'RINGING',
      reason: null,
      offer: 'v=0\r\nm=audio remote\r\nm=video remote',
      answer: null,
      connectedAt: null,
      conversationId: null,
      video: true,
    };
    await vi.advanceTimersByTimeAsync(1500);

    await service.accept();

    const peer = FakePeer.instances[0];
    expect(peer.remoteDescription?.type).toBe('offer');
    expect(peer.addTrack).toHaveBeenCalledWith(cameraTrack, videoStream);
    expect(
      http.post.mock.calls.some(
        ([url, body]) => url.endsWith('/answer') && String(body.answer).includes('m=video'),
      ),
    ).toBe(true);
  });

  it('does not start a call while the multimedia studio owns the microphone', async () => {
    studioStream.set(stream);

    await service.start(person);

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(service.error()).toContain('Cierra el estudio multimedia');
  });

  it('rejects an incoming call without activating the microphone', async () => {
    server = {
      id: 'incoming',
      peer: person,
      outgoing: false,
      status: 'RINGING',
      reason: null,
      offer: 'v=0\r\nm=audio remote',
      answer: null,
      connectedAt: null,
      conversationId: null,
      video: false,
    };
    await vi.advanceTimersByTimeAsync(1500);
    await service.reject();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(service.call()).toBeNull();
    expect(http.post.mock.calls[0][0]).toContain('/reject');
  });

  it('handles denied microphone permission without sending an invitation', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    await service.start(person);
    expect(service.error()).toContain('Permite el micrófono');
    expect(service.busy()).toBe(false);
    expect(http.post.mock.calls.some(([url]) => url.endsWith('/calls'))).toBe(false);
  });

  it('stops a late microphone stream if the user cancels while the permission request is pending', async () => {
    let resolve!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((done) => {
        resolve = done;
      }),
    );
    const starting = service.start(person);
    await service.hangUp();
    resolve(stream);
    await starting;
    expect(track.stop).toHaveBeenCalled();
    expect(FakePeer.instances).toHaveLength(0);
    expect(service.busy()).toBe(false);
  });

  it('times out an unanswered permission request and stops a stream granted afterwards', async () => {
    let resolve!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((done) => {
        resolve = done;
      }),
    );
    const starting = service.start(person);
    expect(service.waitingForMicrophone()).toBe(true);
    await vi.advanceTimersByTimeAsync(30000);
    await starting;
    expect(service.waitingForMicrophone()).toBe(false);
    expect(service.busy()).toBe(false);
    expect(service.error()).toContain('Permite el micrófono');
    resolve(stream);
    for (let tick = 0; tick < 4; tick++) await Promise.resolve();
    expect(track.stop).toHaveBeenCalled();
    expect(FakePeer.instances).toHaveLength(0);
    expect(http.post.mock.calls.some(([url]) => url.endsWith('/calls'))).toBe(false);
  });

  it('fails cleanly when the browser WebRTC negotiation never resolves', async () => {
    vi.spyOn(FakePeer.prototype, 'setLocalDescription').mockImplementation(
      () => new Promise<void>(() => {}),
    );

    const starting = service.start(person);
    expect(service.setupPhase()).toBe('microphone');
    await vi.advanceTimersByTimeAsync(10000);
    await starting;

    expect(service.busy()).toBe(false);
    expect(service.setupPhase()).toBe('idle');
    expect(service.error()).toContain('La negociación de audio no respondió');
    expect(http.post.mock.calls.some(([url]) => url.endsWith('/calls'))).toBe(false);
    expect(track.stop).toHaveBeenCalled();
  });

  it('ignores an old empty poll arriving after an outgoing invitation was created', async () => {
    const delayedPoll = new Subject<VoiceCall | null>();
    http.get.mockReturnValueOnce(delayedPoll);
    await vi.advanceTimersByTimeAsync(1500);
    await service.start(person);
    delayedPoll.next(null);
    delayedPoll.complete();
    await Promise.resolve();
    expect(service.call()?.status).toBe('RINGING');
    expect(track.stop).not.toHaveBeenCalled();
  });

  it('releases the microphone when the authenticated session ends', async () => {
    await service.start(person);
    token.set(null);
    TestBed.tick();
    expect(track.stop).toHaveBeenCalled();
    expect(service.call()).toBeNull();
  });

  it('uses authenticated call endpoints for a local JWT session', async () => {
    http.get.mockClear();
    kind.set('local');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(2000);

    expect(http.get.mock.calls.some(([url]) => url === '/api/calls/current')).toBe(true);
    expect(http.get.mock.calls.some(([url]) => url === '/api/demo/calls/current')).toBe(false);
    expect(http.get.mock.calls.at(-1)?.[1]).toEqual({
      headers: { 'X-Nexo-Call-Session': expect.any(String) },
    });
  });

  it('polls authenticated calls for a Microsoft session without a local token', async () => {
    http.get.mockClear();
    token.set(null);
    kind.set('microsoft');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(2000);

    expect(http.get.mock.calls.some(([url]) => url === '/api/calls/current')).toBe(true);
  });
});
