import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { RemoteTrack } from 'livekit-client';
import { BroadcastMediaService } from '../../../core/media/broadcast-media.service';
import { Broadcast } from '../../../core/media/broadcast-api.service';
import { BroadcastViewerComponent } from './broadcast-viewer.component';

describe('BroadcastViewerComponent', () => {
  const broadcast: Broadcast = {
    id: 'b1',
    conversationId: 'c1',
    hostId: 'h1',
    title: 'Pantalla',
    sourceType: 'SCREEN',
    status: 'LIVE',
  };
  const track = () => ({ attach: vi.fn(), detach: vi.fn() }) as unknown as RemoteTrack;
  const media = {
    watch: vi.fn(),
    video: signal<RemoteTrack | null>(null),
    audioTracks: signal<readonly RemoteTrack[]>([]),
    audioBlocked: signal(false),
    error: signal(''),
    state: signal('LIVE'),
    unlockAudio: vi.fn(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    media.video.set(track());
    media.audioTracks.set([track(), track()]);
    TestBed.configureTestingModule({ imports: [BroadcastViewerComponent] });
    TestBed.overrideComponent(BroadcastViewerComponent, {
      set: { providers: [{ provide: BroadcastMediaService, useValue: media }] },
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  function setup() {
    const fixture = TestBed.createComponent(BroadcastViewerComponent);
    fixture.componentRef.setInput('broadcast', broadcast);
    fixture.detectChanges();
    return fixture;
  }
  it('does not reconnect or reattach the video when metadata changes', () => {
    const fixture = setup();
    const video = fixture.nativeElement.querySelector('video');
    fixture.componentRef.setInput('broadcast', { ...broadcast, title: 'Nuevo título' });
    fixture.detectChanges();
    expect(media.watch).toHaveBeenCalledOnce();
    expect(media.video()!.attach).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('video')).toBe(video);
    expect(fixture.nativeElement.textContent).toContain('Nuevo título');
  });
  it('expands the same container without replacing the media or connection', async () => {
    const fixture = setup();
    const player = fixture.nativeElement.querySelector('.player');
    const video = fixture.nativeElement.querySelector('video');
    player.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    await fixture.componentInstance.toggleFullscreen();
    fixture.detectChanges();
    expect(player.requestFullscreen).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.expanded()).toBe(true);
    expect(fixture.nativeElement.querySelector('video')).toBe(video);
    expect(media.watch).toHaveBeenCalledOnce();
    expect(media.video()!.detach).not.toHaveBeenCalled();
  });
  it('offers an enlarged fallback when native fullscreen is rejected and Escape closes it', async () => {
    const fixture = setup();
    fixture.nativeElement.querySelector('.player').requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error('unsupported'));
    await fixture.componentInstance.toggleFullscreen();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.expanded')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.expanded()).toBe(false);
    expect(media.watch).toHaveBeenCalledOnce();
  });
  it('plays and adjusts both screen and microphone audio and detaches on destroy', () => {
    const fixture = setup();
    const audio = [...fixture.nativeElement.querySelectorAll('audio')] as HTMLAudioElement[];
    expect(audio).toHaveLength(2);
    fixture.componentInstance.volume.set(40);
    fixture.detectChanges();
    expect(audio.every((element) => element.volume === 0.4 && !element.muted)).toBe(true);
    fixture.componentInstance.toggleAudio();
    fixture.detectChanges();
    expect(audio.every((element) => element.muted)).toBe(true);
    fixture.componentInstance.toggleAudio();
    fixture.detectChanges();
    expect(media.unlockAudio).toHaveBeenCalledOnce();
    fixture.destroy();
    for (const track of media.audioTracks()) expect(track.detach).toHaveBeenCalledOnce();
  });
});
