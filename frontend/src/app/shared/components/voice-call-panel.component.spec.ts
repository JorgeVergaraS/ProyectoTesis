import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CallNotificationService } from '../../core/realtime/call-notification.service';
import { VoiceCallService } from '../../core/realtime/voice-call.service';
import { AvatarComponent } from './avatar.component';
import { IconComponent } from './icon.component';
import { VoiceCallPanelComponent } from './voice-call-panel.component';

describe('VoiceCallPanelComponent', () => {
  const localVideoTrack = { kind: 'video' } as MediaStreamTrack;
  const remoteVideoTrack = { kind: 'video' } as MediaStreamTrack;
  const voice = {
    occupied: signal(true),
    call: signal({
      id: 'call-1',
      video: true,
      status: 'ACTIVE',
      outgoing: true,
      conversationId: 'conversation-1',
    }),
    target: signal({ displayName: 'Otra persona', avatarUrl: null, color: '#8b5cf6' }),
    localStream: signal({ getVideoTracks: () => [localVideoTrack] } as unknown as MediaStream),
    remoteStream: signal({ getVideoTracks: () => [remoteVideoTrack] } as unknown as MediaStream),
    remoteCameraEnabled: signal(true),
    notice: signal(''),
    error: signal(''),
    waitingForMicrophone: signal(false),
    busy: signal(false),
    setupPhase: signal('idle'),
    connection: signal('connected'),
    duration: signal('00:04'),
    mediaInUse: signal(false),
    muted: signal(false),
    cameraEnabled: signal(true),
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    hangUp: vi.fn(),
    clearNotice: vi.fn(),
  };

  beforeEach(async () => {
    voice.occupied.set(true);
    voice.call.set({
      id: 'call-1',
      video: true,
      status: 'ACTIVE',
      outgoing: true,
      conversationId: 'conversation-1',
    });
    voice.localStream.set({ getVideoTracks: () => [localVideoTrack] } as unknown as MediaStream);
    voice.remoteStream.set({ getVideoTracks: () => [remoteVideoTrack] } as unknown as MediaStream);
    voice.notice.set('');
    voice.error.set('');
    TestBed.configureTestingModule({
      imports: [VoiceCallPanelComponent],
      providers: [
        { provide: VoiceCallService, useValue: voice },
        { provide: CallNotificationService, useValue: { syncIncomingCall: vi.fn() } },
      ],
    }).overrideComponent(VoiceCallPanelComponent, {
      set: { imports: [AvatarComponent, IconComponent], schemas: [NO_ERRORS_SCHEMA] },
    });
    await TestBed.compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows both participant cameras and enlarges one while keeping the other as picture-in-picture', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fixture = TestBed.createComponent(VoiceCallPanelComponent);
    fixture.detectChanges();

    const videos = fixture.nativeElement.querySelectorAll('.call-video-grid video');
    expect(videos).toHaveLength(2);
    expect(videos[0].getAttribute('aria-label')).toBe('Video de la otra persona');
    expect(videos[1].getAttribute('aria-label')).toBe('Vista previa de tu cámara');

    const enlarge = fixture.nativeElement.querySelector(
      'button[aria-label="Ampliar video de la otra persona"]',
    ) as HTMLButtonElement;
    enlarge.click();
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector('.call-video-grid');
    expect(grid.classList.contains('expanded')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.video-tile.focused .video-label').textContent,
    ).toContain('Otra persona');
    expect(
      fixture.nativeElement.querySelector('.video-tile.picture-in-picture .video-label')
        .textContent,
    ).toContain('Tú');
  });

  it('keeps video tiles and expand controls available while the remote camera is still joining', () => {
    voice.remoteCameraEnabled.set(false);
    voice.remoteStream.set({ getVideoTracks: () => [] } as unknown as MediaStream);
    const fixture = TestBed.createComponent(VoiceCallPanelComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.call-video-grid video')).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Ampliar video de la otra persona"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Ampliar tu cámara"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Esperando el video de la otra persona');
  });
});
