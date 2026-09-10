import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  untracked,
} from '@angular/core';
import type { RemoteTrack } from 'livekit-client';
import { Broadcast } from '../../../core/media/broadcast-api.service';
import { BroadcastMediaService } from '../../../core/media/broadcast-media.service';

@Component({
  selector: 'nexo-broadcast-viewer',
  providers: [BroadcastMediaService],
  template: `
    <section
      #player
      class="player"
      [class.expanded]="expanded()"
      aria-label="Reproductor de transmisión"
    >
      <header>
        <div>
          <span class="live-label">NEXO · EN DIRECTO</span>
          <h3>{{ broadcast().title }}</h3>
        </div>
        <span class="status" role="status">{{ status() }}</span>
      </header>
      <div class="stage">
        <video #video autoplay muted playsinline aria-label="Video en vivo"></video>
        @if (!media.video()) {
          <div class="placeholder">
            <span class="preview-orb"></span>
            <p>{{ status() }}</p>
          </div>
        }
      </div>
      <div #audioContainer class="audio-tracks" aria-hidden="true"></div>
      <div class="controls">
        <button type="button" (click)="toggleAudio()" [attr.aria-pressed]="muted()">
          {{ muted() ? 'Activar sonido' : 'Silenciar sonido' }}
        </button>
        <label class="volume"
          >Volumen<input
            type="range"
            min="0"
            max="100"
            [value]="volume()"
            (input)="volume.set(+$any($event.target).value)"
        /></label>
        <button type="button" (click)="toggleFullscreen()">
          {{ expanded() ? 'Salir de pantalla completa' : 'Pantalla completa' }}
        </button>
      </div>
      @if (media.audioBlocked()) {
        <button class="unlock" (click)="media.unlockAudio()">Activar audio recibido</button>
      }
      @if (media.state() === 'LIVE' && !media.audioTracks().length) {
        <p class="hint">El emisor todavía no ha compartido una pista de audio.</p>
      }
      @if (fullscreenNotice()) {
        <p class="hint" role="status">{{ fullscreenNotice() }}</p>
      }
      @if (media.error()) {
        <p role="alert" class="hint">{{ media.error() }}</p>
      }
      @if (media.state() === 'ERROR') {
        <button (click)="media.watch(broadcast())">Reintentar</button>
      }
    </section>
  `,
  styleUrl: './broadcast-viewer.component.css',
})
export class BroadcastViewerComponent {
  readonly broadcast = input.required<Broadcast>();
  readonly media = inject(BroadcastMediaService);
  readonly expanded = signal(false);
  readonly muted = signal(false);
  readonly volume = signal(80);
  readonly fullscreenNotice = signal('');
  private orientationLocked = false;
  private readonly broadcastId = computed(() => this.broadcast().id);
  private readonly player = viewChild<ElementRef<HTMLElement>>('player');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly audioContainer = viewChild<ElementRef<HTMLDivElement>>('audioContainer');
  private readonly attachedAudio = new Map<RemoteTrack, HTMLAudioElement>();
  constructor() {
    effect(() => {
      this.broadcastId();
      untracked(() => void this.media.watch(this.broadcast()));
    });
    effect((cleanup) => {
      const track = this.media.video(),
        element = this.video()?.nativeElement;
      if (track && element) {
        element.muted = true;
        track.attach(element);
        cleanup(() => track.detach(element));
      }
    });
    effect(() => {
      const tracks = this.media.audioTracks(),
        container = this.audioContainer()?.nativeElement;
      if (!container) return;
      for (const [track, element] of this.attachedAudio) {
        if (tracks.includes(track)) continue;
        track.detach(element);
        element.remove();
        this.attachedAudio.delete(track);
      }
      for (const track of tracks) {
        let element = this.attachedAudio.get(track);
        if (!element) {
          element = document.createElement('audio');
          element.autoplay = true;
          track.attach(element);
          container.appendChild(element);
          this.attachedAudio.set(track, element);
        }
        element.muted = this.muted();
        element.volume = this.volume() / 100;
      }
    });
    inject(DestroyRef).onDestroy(() => {
      for (const [track, element] of this.attachedAudio) {
        track.detach(element);
        element.remove();
      }
      this.attachedAudio.clear();
    });
  }
  toggleAudio() {
    this.muted.update((value) => !value);
    if (!this.muted()) void this.media.unlockAudio();
  }
  async toggleFullscreen() {
    const element = this.player()?.nativeElement;
    if (!element) return;
    if (this.expanded()) {
      if (document.fullscreenElement === element) {
        try {
          await document.exitFullscreen();
          await this.unlockOrientation();
        } catch {
          this.fullscreenNotice.set('Usa Escape para salir de pantalla completa.');
        }
      } else {
        this.expanded.set(false);
        this.clearViewportSize();
        await this.unlockOrientation();
      }
      return;
    }
    this.fullscreenNotice.set('');
    if (element.requestFullscreen) {
      try {
        await element.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        this.expanded.set(true);
        await this.lockOrientationForFullscreen();
        return;
      } catch {
        /* Keep the same player in the enlarged fallback. */
      }
    }
    this.expanded.set(true);
    this.syncViewportSize();
    this.fullscreenNotice.set('Vista ampliada. Tu navegador no ofrece pantalla completa aquí.');
  }
  @HostListener('document:fullscreenchange') fullscreenChanged() {
    this.expanded.set(document.fullscreenElement === this.player()?.nativeElement);
    if (document.fullscreenElement) this.syncViewportSize();
    else {
      this.clearViewportSize();
      void this.unlockOrientation();
    }
  }
  @HostListener('window:resize') viewportChanged() {
    if (this.expanded()) this.syncViewportSize();
  }
  @HostListener('window:orientationchange') orientationChanged() {
    if (!this.expanded()) return;
    // Android browsers may dispatch orientationchange before updating the
    // viewport dimensions. A frame gives the browser time to settle first.
    requestAnimationFrame(() => this.syncViewportSize());
  }
  @HostListener('document:keydown.escape') escape() {
    if (!document.fullscreenElement) {
      this.expanded.set(false);
      this.clearViewportSize();
      void this.unlockOrientation();
    }
  }
  private syncViewportSize() {
    const element = this.player()?.nativeElement;
    if (!element) return;
    element.style.setProperty('--viewer-viewport-width', `${window.innerWidth}px`);
    element.style.setProperty('--viewer-viewport-height', `${window.innerHeight}px`);
  }
  private clearViewportSize() {
    const element = this.player()?.nativeElement;
    element?.style.removeProperty('--viewer-viewport-width');
    element?.style.removeProperty('--viewer-viewport-height');
  }
  private async lockOrientationForFullscreen() {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
    };
    if (!orientation?.lock || window.matchMedia('(min-width: 768px)').matches) return;
    try {
      await orientation.lock('landscape');
      this.orientationLocked = true;
    } catch {
      // Some browsers allow fullscreen but do not expose orientation locking.
    }
  }
  private async unlockOrientation() {
    if (!this.orientationLocked) return;
    try {
      screen.orientation.unlock();
    } finally {
      this.orientationLocked = false;
    }
  }
  status() {
    switch (this.media.state()) {
      case 'CONNECTING':
        return 'Conectando…';
      case 'RECONNECTING':
        return 'Reconectando…';
      case 'LIVE':
        return 'En vivo';
      case 'ENDED':
        return 'La transmisión finalizó.';
      case 'ERROR':
        return 'Sin conexión';
      default:
        return 'Preparando reproductor…';
    }
  }
}
