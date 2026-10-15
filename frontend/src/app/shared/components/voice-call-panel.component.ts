import {
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { VoiceCallService } from '../../core/realtime/voice-call.service';
import { AvatarComponent } from './avatar.component';
import { IconComponent } from './icon.component';
import { BroadcastStudioComponent } from '../../features/home/components/broadcast-studio.component';
import { ConversationBroadcastsComponent } from '../../features/home/components/conversation-broadcasts.component';
import { CallNotificationService } from '../../core/realtime/call-notification.service';

@Component({
  selector: 'nexo-voice-call-panel',
  imports: [
    AvatarComponent,
    IconComponent,
    BroadcastStudioComponent,
    ConversationBroadcastsComponent,
  ],
  template: `
    <audio #remoteAudio autoplay></audio>
    @if (voice.occupied()) {
      <section
        class="voice-panel"
        [attr.aria-label]="voice.call()?.video ? 'Videollamada' : 'Llamada de voz'"
      >
        <header>
          <span
            ><nexo-icon [name]="voice.call()?.video ? 'camera' : 'phone'" />
            {{ voice.call()?.video ? 'VIDEOLLAMADA' : 'LLAMADA DE VOZ' }}</span
          ><button
            class="icon-button"
            [attr.aria-label]="minimized() ? 'Expandir llamada' : 'Minimizar llamada'"
            (click)="minimized.set(!minimized())"
          >
            <nexo-icon name="chevron" />
          </button>
        </header>
        <div class="call-person">
          <nexo-avatar
            [name]="voice.target()?.displayName || ''"
            [src]="voice.target()?.avatarUrl"
            [color]="voice.target()?.color || '#8b5cf6'"
            [large]="!minimized()"
          />
          <div>
            <h2>{{ voice.target()?.displayName }}</h2>
            <p role="status">{{ status() }}</p>
          </div>
        </div>
        @if (!minimized()) {
          @if (voice.call()?.video) {
            <div
              #videoGrid
              class="call-video-grid"
              [class.expanded]="!!expandedVideo()"
              aria-label="Video de la llamada"
            >
              <div
                class="video-tile"
                [class.focused]="expandedVideo() === 'remote'"
                [class.picture-in-picture]="!!expandedVideo() && expandedVideo() !== 'remote'"
              >
                <video
                  #remoteVideo
                  autoplay
                  muted
                  playsinline
                  aria-label="Video de la otra persona"
                ></video>
                @if (!voice.remoteCameraEnabled()) {
                  <div class="video-placeholder">{{ remoteVideoHint() }}</div>
                }
                <span class="video-label">{{ voice.target()?.displayName || 'Otra persona' }}</span>
                <button
                  type="button"
                  class="video-expand"
                  aria-label="Ampliar video de la otra persona"
                  (click)="toggleVideoSize('remote')"
                >
                  {{ expandedVideo() === 'remote' ? 'Reducir' : 'Ampliar' }}
                </button>
              </div>
              <div
                class="video-tile"
                [class.focused]="expandedVideo() === 'local'"
                [class.picture-in-picture]="!!expandedVideo() && expandedVideo() !== 'local'"
              >
                <video
                  #localVideo
                  autoplay
                  muted
                  playsinline
                  aria-label="Vista previa de tu cámara"
                ></video>
                @if (!voice.cameraEnabled()) {
                  <div class="video-placeholder">Tu cámara está apagada</div>
                }
                <span class="video-label">Tú</span>
                <button
                  type="button"
                  class="video-expand"
                  aria-label="Ampliar tu cámara"
                  (click)="toggleVideoSize('local')"
                >
                  {{ expandedVideo() === 'local' ? 'Reducir' : 'Ampliar' }}
                </button>
              </div>
              @if (expandedVideo()) {
                <button class="video-close" type="button" (click)="closeExpandedVideo()">
                  Cerrar vista ampliada
                </button>
              }
            </div>
          }
          @if (voice.notice()) {
            <p class="call-notice" role="status">{{ voice.notice() }}</p>
          }
          @if (voice.error()) {
            <p class="call-error" role="alert">{{ voice.error() }}</p>
          }
          @if (voice.call()?.status === 'RINGING' && !voice.call()?.outgoing && !voice.busy()) {
            <p class="call-help">
              {{
                voice.mediaInUse()
                  ? 'Cierra el estudio multimedia para poder aceptar.'
                  : voice.call()?.video
                    ? 'Te está llamando. Al aceptar se solicitará acceso al micrófono y a la cámara.'
                    : 'Te está llamando. Al aceptar se solicitará acceso al micrófono.'
              }}
            </p>
            <div class="call-actions">
              <button class="accept" [disabled]="voice.mediaInUse()" (click)="voice.accept()">
                Aceptar llamada</button
              ><button class="hangup" (click)="voice.reject()">Rechazar</button>
            </div>
          } @else {
            <div class="call-actions">
              <button
                class="secondary-button"
                [disabled]="voice.busy()"
                [attr.aria-pressed]="voice.muted()"
                (click)="voice.toggleMute()"
              >
                <nexo-icon name="mic" />{{ voice.muted() ? 'Activar micrófono' : 'Silenciar' }}
              </button>
              @if (voice.call()?.video) {
                <button
                  class="secondary-button"
                  [disabled]="voice.busy()"
                  [attr.aria-pressed]="voice.cameraEnabled()"
                  (click)="voice.toggleCamera()"
                >
                  <nexo-icon name="camera" />{{
                    voice.cameraEnabled() ? 'Apagar cámara' : 'Activar cámara'
                  }}
                </button>
              }
              <button class="hangup" (click)="voice.hangUp()">Finalizar</button>
            </div>
            @if (audioBlocked()) {
              <button class="primary-button audio-unlock" (click)="playAudio()">
                Activar audio recibido
              </button>
            }
            @if (voice.call()?.conversationId; as conversationId) {
              <details class="call-broadcasts">
                <summary>Transmitir en esta llamada</summary>
                <nexo-broadcast-studio [inCall]="true" [conversationId]="conversationId" />
                <nexo-conversation-broadcasts [conversationId]="conversationId" />
              </details>
            }
          }
          <p class="call-help">
            Usa audífonos para evitar eco. Nexo transmite audio y video en vivo y no graba la
            llamada.
          </p>
        }
      </section>
    } @else if (voice.notice() || voice.error()) {
      <div class="call-toast" role="status">
        <span>{{ voice.error() || voice.notice() }}</span
        ><button
          class="icon-button"
          aria-label="Cerrar aviso de llamada"
          (click)="voice.clearNotice()"
        >
          <nexo-icon name="close" />
        </button>
      </div>
    }
  `,
  styles: `
    .voice-panel {
      position: fixed;
      z-index: 60;
      bottom: 24px;
      right: 24px;
      box-sizing: border-box;
      width: min(420px, calc(100vw - 28px));
      max-height: calc(100dvh - 48px);
      overflow: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      padding: 18px;
      border: 1px solid #665084;
      border-radius: 19px;
      background: linear-gradient(145deg, #181529, #0b1420);
      box-shadow: 0 15px 70px #000b;
    }
    header,
    header span,
    .call-person,
    .call-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header {
      justify-content: space-between;
      margin-bottom: 15px;
    }
    header span {
      font-size: 10px;
      letter-spacing: 1px;
      color: #c1afe4;
    }
    .call-person h2 {
      min-width: 0;
      margin: 0;
      font-size: 19px;
      font-weight: 550;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .call-person p {
      font-size: 12px;
      color: #b8d7ce;
      margin: 7px 0 0;
    }
    .call-video-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .video-tile {
      position: relative;
      min-width: 0;
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 12px;
      background: #060a12;
      overflow: hidden;
    }
    .video-tile video,
    .video-placeholder {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
      background: #060a12;
    }
    .video-placeholder {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      background: #060a1299;
    }
    .video-label {
      position: absolute;
      left: 9px;
      bottom: 9px;
      padding: 5px 8px;
      border-radius: 999px;
      background: #07101dcc;
      color: #fff;
      font-size: 11px;
      pointer-events: none;
    }
    .video-expand,
    .video-close {
      position: absolute;
      z-index: 2;
      top: 8px;
      right: 8px;
      min-height: 36px;
      border: 1px solid #ffffff55;
      border-radius: 9px;
      padding: 6px 10px;
      color: #fff;
      background: #111827d9;
      cursor: pointer;
    }
    .video-close {
      left: 10px;
      right: auto;
      display: none;
    }
    .call-video-grid.expanded,
    .call-video-grid:fullscreen {
      position: fixed;
      z-index: 120;
      inset: 0;
      width: var(--call-video-width, 100vw);
      height: var(--call-video-height, 100dvh);
      max-width: none;
      box-sizing: border-box;
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      gap: 0;
      margin: 0;
      padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
        max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
      background: #03060b;
    }
    .call-video-grid.expanded .video-tile,
    .call-video-grid:fullscreen .video-tile {
      display: none;
    }
    .call-video-grid.expanded .video-tile.focused,
    .call-video-grid:fullscreen .video-tile.focused {
      display: block;
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
      border-radius: 14px;
    }
    .call-video-grid.expanded .video-tile.picture-in-picture,
    .call-video-grid:fullscreen .video-tile.picture-in-picture {
      position: absolute;
      z-index: 1;
      right: max(20px, env(safe-area-inset-right));
      bottom: max(20px, env(safe-area-inset-bottom));
      display: block;
      width: clamp(120px, 23vw, 260px);
      height: auto;
      aspect-ratio: 16 / 10;
      border: 2px solid #fff9;
      box-shadow: 0 5px 24px #000b;
    }
    .call-video-grid.expanded .video-close,
    .call-video-grid:fullscreen .video-close {
      display: block;
      top: max(20px, env(safe-area-inset-top));
      left: max(20px, env(safe-area-inset-left));
    }
    .call-video-grid.expanded .video-expand,
    .call-video-grid:fullscreen .video-expand {
      display: none;
    }
    .video-placeholder {
      display: grid;
      place-items: center;
      padding: 8px;
      box-sizing: border-box;
      color: #aab8cc;
      text-align: center;
      font-size: 11px;
    }
    .call-actions {
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .call-actions button {
      min-width: 0;
      flex: 1;
      min-height: 44px;
      font-size: 11px;
      border-radius: 9px;
      padding: 9px;
      border: 1px solid #52516c;
    }
    .accept {
      background: #1d6547;
      color: white;
    }
    .hangup {
      background: #a22c49;
      color: white;
    }
    .call-help {
      font-size: 10px;
      line-height: 1.8;
      color: #9aabc0;
      margin: 15px 0 0;
    }
    .call-error {
      font-size: 11px;
      color: #fcb2c5;
    }
    .call-notice {
      font-size: 11px;
      color: #bfe6d8;
    }
    .audio-unlock {
      margin-top: 12px;
      width: 100%;
    }
    .call-broadcasts {
      margin-top: 14px;
      border-top: 1px solid #ffffff18;
      padding-top: 12px;
    }
    .call-broadcasts summary {
      cursor: pointer;
      color: #bfa8e4;
      font-size: 11px;
      font-weight: 600;
    }
    .call-broadcasts nexo-broadcast-studio,
    .call-broadcasts nexo-conversation-broadcasts {
      display: block;
      min-width: 0;
    }
    .call-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 65;
      max-width: min(440px, calc(100vw - 28px));
      display: flex;
      align-items: center;
      gap: 12px;
      background: #211a33;
      border: 1px solid #67517f;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 12px;
      line-height: 1.7;
      box-shadow: 0 5px 30px #0008;
    }
    @media (max-width: 760px) {
      .voice-panel,
      .call-toast {
        bottom: 14px;
        right: 14px;
      }
    }
    @media (max-width: 480px) {
      .voice-panel {
        left: max(8px, env(safe-area-inset-left));
        right: max(8px, env(safe-area-inset-right));
        bottom: max(8px, env(safe-area-inset-bottom));
        width: auto;
        max-width: none;
        max-height: calc(
          100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))
        );
        padding: 12px;
        border-radius: 16px;
      }
      .call-actions {
        gap: 8px;
        margin-top: 14px;
      }
      .call-actions button {
        padding: 8px 6px;
        font-size: 10px;
      }
      .call-help {
        line-height: 1.55;
      }
      .call-video-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .call-toast {
        left: max(8px, env(safe-area-inset-left));
        right: max(8px, env(safe-area-inset-right));
        bottom: max(8px, env(safe-area-inset-bottom));
        max-width: none;
      }
    }
    @media (orientation: landscape) and (max-height: 520px) {
      .voice-panel {
        top: max(8px, env(safe-area-inset-top));
        bottom: max(8px, env(safe-area-inset-bottom));
        max-height: none;
      }
      .call-person h2 {
        font-size: 16px;
      }
      .call-actions {
        margin-top: 10px;
      }
    }
  `,
})
export class VoiceCallPanelComponent {
  readonly voice = inject(VoiceCallService);
  private readonly callAlerts = inject(CallNotificationService);
  readonly minimized = signal(false);
  readonly audioBlocked = signal(false);
  readonly expandedVideo = signal<'local' | 'remote' | null>(null);
  readonly audio = viewChild<ElementRef<HTMLAudioElement>>('remoteAudio');
  private readonly videoGrid = viewChild<ElementRef<HTMLElement>>('videoGrid');
  readonly remoteVideo = viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');
  readonly localVideo = viewChild<ElementRef<HTMLVideoElement>>('localVideo');
  constructor() {
    effect(() => {
      const call = this.voice.call();
      const incomingId = call && !call.outgoing && call.status === 'RINGING' ? call.id : null;
      this.callAlerts.syncIncomingCall(incomingId);
    });
    effect(() => {
      const element = this.remoteVideo()?.nativeElement;
      const stream = this.voice.remoteStream();
      if (!element) return;
      // Keep the video renderer silent; incoming audio has one dedicated output below.
      element.muted = true;
      element.volume = 0;
      element.srcObject = stream;
      if (stream) void element.play().catch(() => undefined);
    });
    effect(() => {
      const element = this.localVideo()?.nativeElement;
      const stream = this.voice.localStream();
      if (!element) return;
      element.muted = true;
      element.volume = 0;
      element.srcObject = stream;
      if (stream) void element.play().catch(() => undefined);
    });
    effect(() => {
      const element = this.audio()?.nativeElement;
      const stream = this.voice.remoteStream();
      if (!element) return;
      // Do not attach the combined audio/video stream to both renderers. This
      // guarantees that the remote audio can only be played by this element.
      const audioTracks = stream?.getAudioTracks() ?? [];
      element.srcObject = audioTracks.length ? new MediaStream(audioTracks) : null;
      element.muted = false;
      element.volume = 1;
      if (stream) void this.playAudio();
      else {
        if (!element.paused) element.pause();
        this.audioBlocked.set(false);
      }
    });
  }
  status(): string {
    if (this.voice.waitingForMicrophone()) return 'Esperando permiso del micrófono…';
    if (this.voice.busy()) {
      const phases = {
        idle: 'Preparando llamada…',
        microphone: this.voice.call()?.video
          ? 'Solicitando acceso a cámara y micrófono…'
          : 'Solicitando acceso al micrófono…',
        ice: 'Consultando servidores de conexión…',
        gathering: 'Buscando una ruta de audio…',
        signaling: 'Conectando con la otra persona…',
      } as const;
      return phases[this.voice.setupPhase()];
    }
    if (this.voice.connection() === 'connected')
      return (
        (this.voice.call()?.video ? 'Videollamada conectada · ' : 'Audio conectado · ') +
        this.voice.duration()
      );
    if (this.voice.connection() === 'disconnected') return 'Reconectando llamada…';
    const call = this.voice.call();
    return call?.status === 'RINGING'
      ? call.outgoing
        ? 'Llamando…'
        : 'Llamada entrante'
      : 'Conectando audio…';
  }
  async playAudio(): Promise<void> {
    try {
      await this.audio()?.nativeElement.play();
      this.audioBlocked.set(false);
    } catch {
      this.audioBlocked.set(true);
    }
  }
  remoteVideoHint(): string {
    const tracks = this.voice.remoteStream()?.getVideoTracks() ?? [];
    if (tracks.some((track) => track.readyState === 'live' && track.muted)) {
      return 'Conectando el video de la otra persona…';
    }
    return tracks.length
      ? 'La cámara de la otra persona está apagada.'
      : 'Esperando el video de la otra persona…';
  }
  async toggleVideoSize(participant: 'local' | 'remote'): Promise<void> {
    if (this.expandedVideo() === participant) {
      await this.closeExpandedVideo();
      return;
    }
    this.expandedVideo.set(participant);
    const grid = this.videoGrid()?.nativeElement;
    if (!grid) return;
    this.syncVideoViewport();
    if (grid.requestFullscreen) {
      try {
        await grid.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } catch {
        // Fixed-position layout provides a full-viewport fallback on mobile browsers.
      }
    }
  }
  async closeExpandedVideo(): Promise<void> {
    const grid = this.videoGrid()?.nativeElement;
    if (grid && document.fullscreenElement === grid) {
      try {
        await document.exitFullscreen();
      } catch {
        // Keep the in-page fallback available if native fullscreen cannot exit.
      }
    }
    this.expandedVideo.set(null);
    this.clearVideoViewport();
  }
  @HostListener('document:fullscreenchange') fullscreenChanged(): void {
    if (document.fullscreenElement === this.videoGrid()?.nativeElement) {
      this.syncVideoViewport();
    } else if (this.expandedVideo()) {
      this.expandedVideo.set(null);
      this.clearVideoViewport();
    }
  }
  @HostListener('document:keydown.escape') escapeExpandedVideo(): void {
    if (!document.fullscreenElement && this.expandedVideo()) void this.closeExpandedVideo();
  }
  @HostListener('window:resize') resizeExpandedVideo(): void {
    if (this.expandedVideo()) this.syncVideoViewport();
  }
  @HostListener('window:orientationchange') orientationChanged(): void {
    if (this.expandedVideo()) requestAnimationFrame(() => this.syncVideoViewport());
  }
  private syncVideoViewport(): void {
    const grid = this.videoGrid()?.nativeElement;
    if (!grid) return;
    grid.style.setProperty(
      '--call-video-width',
      `${window.visualViewport?.width ?? window.innerWidth}px`,
    );
    grid.style.setProperty(
      '--call-video-height',
      `${window.visualViewport?.height ?? window.innerHeight}px`,
    );
  }
  private clearVideoViewport(): void {
    const grid = this.videoGrid()?.nativeElement;
    grid?.style.removeProperty('--call-video-width');
    grid?.style.removeProperty('--call-video-height');
  }
}
