import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { DemoSessionStore } from '../auth/demo-session.store';
import { MediaDeviceService } from '../media/media-device.service';
import { VoiceCall, VoiceCallService } from './voice-call.service';

class FakePeer {
  static instances: FakePeer[] = [];
  connectionState = 'new';
  iceGatheringState = 'complete';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack = vi.fn();
  close = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\nm=audio offer' }));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'v=0\r\nm=audio answer' }));
  async setLocalDescription(value: RTCSessionDescriptionInit) {
    this.localDescription = value;
  }
  async setRemoteDescription(value: RTCSessionDescriptionInit) {
    this.remoteDescription = value;
  }
  constructor() {
    FakePeer.instances.push(this);
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
  } as unknown as MediaStream;
  const getUserMedia = vi.fn();
  const http = { get: vi.fn(), post: vi.fn() };
  const studioStream = signal<MediaStream | null>(null);

  beforeEach(async () => {
    vi.useFakeTimers();
    FakePeer.instances = [];
    token.set('demo-token');
    kind.set('demo');
    currentUser.set({ ...person, id: 'jorge' });
    studioStream.set(null);
    track.enabled = true;
    track.stop.mockClear();
    server = null;
    getUserMedia.mockReset().mockResolvedValue(stream);
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    http.get.mockReset().mockImplementation(() => of(server));
    http.post.mockReset().mockImplementation((url: string, body: Record<string, string>) => {
      if (url.endsWith('/calls')) {
        server = {
          id: body['id'],
          peer: person,
          outgoing: true,
          status: 'RINGING',
          reason: null,
          offer: null,
          answer: null,
          connectedAt: null,
          conversationId: null,
        };
      } else if (server && url.endsWith('/accept')) server = { ...server, status: 'CONNECTING' };
      else if (server && url.endsWith('/answer')) server = { ...server, answer: body['answer'] };
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('negotiates an outgoing call, applies its answer, mutes and releases media on hangup', async () => {
    await service.start(person);
    const peer = FakePeer.instances[0];
    expect(service.call()?.status).toBe('RINGING');
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    expect(peer.addTrack).toHaveBeenCalledWith(track, stream);
    server = { ...server!, status: 'CONNECTING', answer: 'v=0\r\nm=audio remote' };
    await vi.advanceTimersByTimeAsync(1500);
    expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: server.answer });
    peer.ontrack?.({ streams: [stream] });
    expect(service.remoteStream()).toBe(stream);
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
    };
    await vi.advanceTimersByTimeAsync(1500);
    expect(getUserMedia).not.toHaveBeenCalled();
    await service.accept();
    expect(FakePeer.instances[0].remoteDescription?.type).toBe('offer');
    expect(
      http.post.mock.calls.some(
        ([url, body]) => url.endsWith('/answer') && body.answer.includes('audio'),
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
    await Promise.resolve();
    expect(track.stop).toHaveBeenCalled();
    expect(FakePeer.instances).toHaveLength(0);
    expect(http.post.mock.calls.some(([url]) => url.endsWith('/calls'))).toBe(false);
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
