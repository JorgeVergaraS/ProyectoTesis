import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BroadcastApiService } from '../../../core/media/broadcast-api.service';
import { ChatService } from '../../../core/services/chat.service';
import { MediaDeviceService } from '../../../core/media/media-device.service';
import { VoiceCallService } from '../../../core/realtime/voice-call.service';
import { BroadcastStudioComponent } from './broadcast-studio.component';

describe('BroadcastStudioComponent', () => {
  const stream = signal<MediaStream | null>(null);
  const source = signal<'camera' | 'screen' | null>(null);
  const occupied = signal(false);
  const media = {
    stream,
    source,
    audioInputs: signal([{ deviceId: 'mic-1', label: 'Micrófono' }]),
    videoInputs: signal([{ deviceId: 'cam-1', label: 'Cámara' }]),
    selectedAudioId: signal('mic-1'),
    selectedVideoId: signal('cam-1'),
    microphoneMuted: signal(false),
    audioLevel: signal(35),
    stopReason: signal(null),
    cameraSupported: true,
    screenSupported: true,
    start: vi.fn(async (selectedSource: 'camera' | 'screen') => {
      const next = {} as MediaStream;
      source.set(selectedSource);
      stream.set(next);
      return next;
    }),
    changeMicrophone: vi.fn().mockResolvedValue(undefined),
    changeCamera: vi.fn().mockResolvedValue(undefined),
    toggleMicrophone: vi.fn(),
    stop: vi.fn(() => {
      stream.set(null);
      source.set(null);
    }),
  };

  beforeEach(() => {
    stream.set(null);
    occupied.set(false);
    source.set(null);
    media.start.mockClear();
    media.stop.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [BroadcastStudioComponent],
      providers: [
        { provide: BroadcastApiService, useValue: { config: () => of({ enabled: false }) } },
        { provide: ChatService, useValue: { workspace: () => of({ channels: [], directs: [] }) } },
        { provide: MediaDeviceService, useValue: media },
        { provide: VoiceCallService, useValue: { occupied } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('does not request devices until the user prepares a private preview', async () => {
    const fixture = TestBed.createComponent(BroadcastStudioComponent);
    fixture.detectChanges();
    expect(media.start).not.toHaveBeenCalled();

    const button = fixture.nativeElement.querySelector('.prepare-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(media.start).toHaveBeenCalledWith('camera', '', '', 30);
    expect(fixture.componentInstance.state()).toBe('PREVIEWING');
    expect(fixture.nativeElement.textContent).toContain('Nada se está transmitiendo');
  });

  it('blocks media preparation while a voice call is active', async () => {
    occupied.set(true);
    const fixture = TestBed.createComponent(BroadcastStudioComponent);
    fixture.detectChanges();

    await fixture.componentInstance.prepare();
    fixture.detectChanges();

    expect(media.start).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Finaliza la llamada de voz');
  });

  it('mutes and finishes the local preview from visible controls', async () => {
    const fixture = TestBed.createComponent(BroadcastStudioComponent);
    fixture.detectChanges();
    await fixture.componentInstance.prepare();
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons.find((button) => button.textContent.includes('Silenciar'))?.click();
    buttons.find((button) => button.textContent.includes('Finalizar vista previa'))?.click();
    fixture.detectChanges();

    expect(media.toggleMicrophone).toHaveBeenCalledOnce();
    expect(media.stop).toHaveBeenCalledWith('user');
    expect(fixture.componentInstance.state()).toBe('IDLE');
  });

  it('asks before closing an active preview and preserves it when cancelled', async () => {
    const fixture = TestBed.createComponent(BroadcastStudioComponent);
    fixture.detectChanges();
    await fixture.componentInstance.prepare();
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);

    expect(fixture.componentInstance.confirmClose()).toBe(false);
    expect(media.stop).not.toHaveBeenCalled();

    confirmation.mockReturnValue(true);
    expect(fixture.componentInstance.confirmClose()).toBe(true);
    expect(media.stop).toHaveBeenCalledWith('user');
  });
});
