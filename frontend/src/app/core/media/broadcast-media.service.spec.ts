import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { Broadcast, BroadcastApiService, BroadcastAccess } from './broadcast-api.service';
import { BroadcastMediaService } from './broadcast-media.service';

const sdk = vi.hoisted(() => ({ rooms: [] as any[] }));
vi.mock('livekit-client', () => ({
  Track: {
    Source: {
      Microphone: 'microphone',
      Camera: 'camera',
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
  RoomEvent: {
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
    TrackSubscribed: 'subscribed',
    TrackUnsubscribed: 'unsubscribed',
    AudioPlaybackStatusChanged: 'audio',
  },
  Room: class {
    handlers: Record<string, (...args: any[]) => void> = {};
    localParticipant = { publishTrack: vi.fn().mockResolvedValue(undefined) };
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    startAudio = vi.fn().mockResolvedValue(undefined);
    canPlaybackAudio = true;
    constructor() {
      sdk.rooms.push(this);
    }
    on(event: string, callback: (...args: any[]) => void) {
      this.handlers[event] = callback;
    }
  },
}));

describe('BroadcastMediaService', () => {
  const broadcast: Broadcast = {
    id: 'b',
    hostId: 'host',
    conversationId: 'channel',
    title: 'Test',
    sourceType: 'CAMERA',
    status: 'LIVE',
  };
  let service: BroadcastMediaService;
  const api = {
    create: vi.fn(),
    access: vi.fn(),
    start: vi.fn(),
    end: vi.fn(),
  };
  beforeEach(() => {
    sdk.rooms.length = 0;
    api.create.mockReset().mockReturnValue(of(broadcast));
    api.access
      .mockReset()
      .mockReturnValue(of({ url: 'ws://localhost:7880', token: 'test', role: 'VIEWER' }));
    api.start.mockReset().mockReturnValue(of(broadcast));
    api.end.mockReset().mockReturnValue(of({ ...broadcast, status: 'ENDED' }));
    TestBed.configureTestingModule({
      providers: [BroadcastMediaService, { provide: BroadcastApiService, useValue: api }],
    });
    service = TestBed.inject(BroadcastMediaService);
  });
  afterEach(async () => {
    await service.stop();
    TestBed.resetTestingModule();
  });

  it('subscribes without publishing and recovers reconnection and autoplay', async () => {
    await service.watch(broadcast);
    const room = sdk.rooms[0];
    expect(room.localParticipant.publishTrack).not.toHaveBeenCalled();
    expect(room.connect).toHaveBeenCalledWith('ws://localhost:7880', 'test', {
      autoSubscribe: true,
    });
    room.handlers.reconnecting();
    expect(service.state()).toBe('RECONNECTING');
    room.handlers.reconnected();
    expect(service.state()).toBe('LIVE');
    room.canPlaybackAudio = false;
    room.handlers.audio();
    expect(service.audioBlocked()).toBe(true);
    await service.unlockAudio();
    expect(room.startAudio).toHaveBeenCalled();
    expect(service.audioBlocked()).toBe(false);
  });
  it('rejects an unexpected server role before connecting', async () => {
    api.access.mockReturnValue(of({ url: 'ws://localhost:7880', token: 'test', role: 'HOST' }));
    await service.watch(broadcast);
    expect(service.state()).toBe('ERROR');
    expect(sdk.rooms).toHaveLength(0);
  });
  it('cancels an immediate watch before it connects', async () => {
    const pending = service.watch(broadcast);
    await service.stop();
    await pending;
    expect(api.access).not.toHaveBeenCalled();
    expect(sdk.rooms).toHaveLength(0);
    expect(service.state()).toBe('IDLE');
  });
  it('only connects the latest of two concurrent watch requests', async () => {
    await Promise.all([service.watch(broadcast), service.watch({ ...broadcast, id: 'latest' })]);
    expect(api.access).toHaveBeenCalledOnce();
    expect(api.access).toHaveBeenCalledWith('latest');
    expect(sdk.rooms).toHaveLength(1);
  });
  it('does not connect after the viewer closes while access is pending', async () => {
    const access = new Subject<BroadcastAccess>();
    api.access.mockReturnValue(access);
    const pending = service.watch(broadcast);
    await vi.waitFor(() => expect(api.access).toHaveBeenCalled());
    await service.stop();
    access.next({ url: 'ws://localhost:7880', token: 'test', role: 'VIEWER' });
    access.complete();
    await pending;
    expect(sdk.rooms).toHaveLength(0);
    expect(service.state()).toBe('IDLE');
  });
  it('publishes separate screen and microphone tracks and ends the server room', async () => {
    api.access.mockReturnValue(of({ url: 'ws://localhost:7880', token: 'test', role: 'HOST' }));
    const systemAudio = { id: 'system-audio', kind: 'audio', readyState: 'live' },
      microphone = { id: 'microphone', kind: 'audio', readyState: 'live' },
      video = { id: 'video', kind: 'video', readyState: 'live' };
    await service.publish(
      'channel',
      'Test',
      'SCREEN',
      {
        getTracks: () => [video, systemAudio, microphone],
        getAudioTracks: () => [systemAudio, microphone],
      } as unknown as MediaStream,
      { screenAudioTrackIds: [systemAudio.id] },
    );
    const room = sdk.rooms[0];
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(
      video,
      expect.objectContaining({ source: 'screen_share' }),
    );
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(
      systemAudio,
      expect.objectContaining({ source: 'screen_share_audio' }),
    );
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(
      microphone,
      expect.objectContaining({ source: 'microphone' }),
    );
    expect(service.state()).toBe('LIVE');
    expect(api.start).toHaveBeenCalledWith('b');
    await service.stop();
    expect(room.disconnect).toHaveBeenCalled();
    expect(api.end).toHaveBeenCalledWith('b');
  });
  it('keeps every subscribed audio track for screen sound and microphone', async () => {
    await service.watch(broadcast);
    const screenAudio = { kind: 'audio', detach: vi.fn() };
    const microphone = { kind: 'audio', detach: vi.fn() };
    sdk.rooms[0].handlers.subscribed(screenAudio);
    sdk.rooms[0].handlers.subscribed(microphone);
    expect(service.audioTracks()).toEqual([screenAudio, microphone]);
    sdk.rooms[0].handlers.unsubscribed(screenAudio);
    expect(service.audioTracks()).toEqual([microphone]);
  });
  it('clears attached media when the server ends the room', async () => {
    await service.watch(broadcast);
    const track = { kind: 'video', detach: vi.fn() };
    sdk.rooms[0].handlers.subscribed(track);
    expect(service.video()).toBe(track);
    sdk.rooms[0].handlers.disconnected();
    expect(service.video()).toBeNull();
    expect(track.detach).toHaveBeenCalled();
    expect(service.state()).toBe('ENDED');
  });
});
