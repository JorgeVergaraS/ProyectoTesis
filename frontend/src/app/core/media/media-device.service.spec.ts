import { TestBed } from '@angular/core/testing';
import { MediaDeviceService } from './media-device.service';

type FakeTrack = MediaStreamTrack & {
  onended: ((this: MediaStreamTrack, event: Event) => unknown) | null;
};

class FakeStream {
  constructor(private readonly tracks: FakeTrack[]) {}
  getTracks = () => [...this.tracks];
  getAudioTracks = () => this.tracks.filter((track) => track.kind === 'audio');
  getVideoTracks = () => this.tracks.filter((track) => track.kind === 'video');
}

function fakeTrack(kind: 'audio' | 'video', deviceId: string): FakeTrack {
  return {
    kind,
    enabled: true,
    onended: null,
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
  } as unknown as FakeTrack;
}

describe('MediaDeviceService', () => {
  let service: MediaDeviceService;
  let deviceChange: (() => void) | null;
  const getUserMedia = vi.fn();
  const getDisplayMedia = vi.fn();
  const enumerateDevices = vi.fn();

  beforeEach(() => {
    deviceChange = null;
    getUserMedia.mockReset();
    getDisplayMedia.mockReset();
    enumerateDevices.mockReset().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Micrófono integrado' },
      { kind: 'audioinput', deviceId: 'mic-2', label: 'Audífonos' },
      { kind: 'videoinput', deviceId: 'cam-1', label: 'Cámara integrada' },
    ]);
    vi.stubGlobal(
      'MediaStream',
      class extends FakeStream {
        constructor(tracks: FakeTrack[] = []) {
          super(tracks);
        }
      },
    );
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        getDisplayMedia,
        enumerateDevices,
        addEventListener: vi.fn((name: string, listener: () => void) => {
          if (name === 'devicechange') deviceChange = listener;
        }),
        removeEventListener: vi.fn(),
      },
    });
    TestBed.configureTestingModule({ providers: [MediaDeviceService] });
    service = TestBed.inject(MediaDeviceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('requests camera and microphone only after preparation and releases both tracks', async () => {
    const microphone = fakeTrack('audio', 'mic-1');
    const camera = fakeTrack('video', 'cam-1');
    getUserMedia.mockResolvedValue(new FakeStream([microphone, camera]));

    expect(getUserMedia).not.toHaveBeenCalled();
    await service.start('camera');

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: { frameRate: { ideal: 30, max: 30 } },
    });
    expect(service.source()).toBe('camera');
    expect(service.audioInputs()).toHaveLength(2);
    service.toggleMicrophone();
    expect(microphone.enabled).toBe(false);
    expect(service.microphoneMuted()).toBe(true);

    service.stop();
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(camera.stop).toHaveBeenCalledOnce();
    expect(service.stream()).toBeNull();
  });

  it('combines a shared screen with the microphone and stops when sharing ends', async () => {
    const screen = fakeTrack('video', 'screen');
    const systemAudio = fakeTrack('audio', 'system');
    const microphone = fakeTrack('audio', 'mic-1');
    getDisplayMedia.mockResolvedValue(new FakeStream([screen, systemAudio]));
    getUserMedia.mockResolvedValue(new FakeStream([microphone]));

    await service.start('screen');

    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: { frameRate: { ideal: 30, max: 30 } },
      audio: true,
      systemAudio: 'include',
      surfaceSwitching: 'include',
    });
    expect(service.stream()?.getTracks()).toHaveLength(3);
    screen.onended?.call(screen, new Event('ended'));
    expect(service.stopReason()).toBe('source-ended');
    expect(service.stream()).toBeNull();
    expect(screen.stop).toHaveBeenCalledOnce();
    expect(systemAudio.stop).toHaveBeenCalledOnce();
    expect(microphone.stop).toHaveBeenCalledOnce();
  });

  it('changes microphones without requesting the screen picker again', async () => {
    const screen = fakeTrack('video', 'screen');
    const firstMicrophone = fakeTrack('audio', 'mic-1');
    const secondMicrophone = fakeTrack('audio', 'mic-2');
    getDisplayMedia.mockResolvedValue(new FakeStream([screen]));
    getUserMedia
      .mockResolvedValueOnce(new FakeStream([firstMicrophone]))
      .mockResolvedValueOnce(new FakeStream([secondMicrophone]));
    await service.start('screen');
    service.toggleMicrophone();

    await service.changeMicrophone('mic-2');

    expect(getDisplayMedia).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenLastCalledWith({
      audio: { deviceId: { exact: 'mic-2' } },
      video: false,
    });
    expect(firstMicrophone.stop).toHaveBeenCalledOnce();
    expect(screen.stop).not.toHaveBeenCalled();
    expect(service.selectedAudioId()).toBe('mic-2');
    expect(secondMicrophone.enabled).toBe(false);
    expect(service.microphoneMuted()).toBe(true);
  });

  it('releases a late stream when navigation cancels a pending permission request', async () => {
    const microphone = fakeTrack('audio', 'mic-1');
    const camera = fakeTrack('video', 'cam-1');
    let resolvePermission!: (stream: FakeStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<FakeStream>((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const pending = service.start('camera');
    service.stop('navigation');
    resolvePermission(new FakeStream([microphone, camera]));

    await expect(pending).rejects.toThrow('request-cancelled');
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(camera.stop).toHaveBeenCalledOnce();
  });

  it('stops the preview when the selected input is disconnected', async () => {
    const microphone = fakeTrack('audio', 'mic-1');
    const camera = fakeTrack('video', 'cam-1');
    getUserMedia.mockResolvedValue(new FakeStream([microphone, camera]));
    await service.start('camera');
    enumerateDevices.mockResolvedValue([]);

    deviceChange?.();
    await vi.waitFor(() => expect(service.stream()).toBeNull());

    expect(service.stopReason()).toBe('device-lost');
  });
});
