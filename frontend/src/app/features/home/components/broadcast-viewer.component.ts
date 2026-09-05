import { Component, ElementRef, effect, inject, input, viewChild, untracked } from '@angular/core';
import { Broadcast } from '../../../core/media/broadcast-api.service';
import { BroadcastMediaService } from '../../../core/media/broadcast-media.service';

@Component({
  selector: 'nexo-broadcast-viewer',
  providers: [BroadcastMediaService],
  template: ` <section aria-label="Reproductor de transmisión">
    <strong>{{ broadcast().title }}</strong>
    <p role="status">{{ status() }}</p>
    <video #video autoplay playsinline controls aria-label="Video en vivo"></video>
    <audio #audio autoplay></audio>
    @if (media.audioBlocked()) {
      <button class="primary-button" (click)="media.unlockAudio()">Activar audio</button>
    }
    @if (media.error()) {
      <p role="alert">{{ media.error() }}</p>
    }
    @if (media.state() === 'ERROR') {
      <button class="secondary-button" (click)="media.watch(broadcast())">Reintentar</button>
    }
  </section>`,
  styles: [
    `
      :host {
        display: block;
      }
      section {
        padding: 12px;
      }
      video {
        display: block;
        width: 100%;
        max-height: 45vh;
        background: #080808;
        border-radius: 12px;
      }
      p {
        font-size: 0.85rem;
      }
      button {
        margin-top: 8px;
      }
    `,
  ],
})
export class BroadcastViewerComponent {
  readonly broadcast = input.required<Broadcast>();
  readonly media = inject(BroadcastMediaService);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');
  constructor() {
    effect(() => {
      const broadcast = this.broadcast();
      untracked(() => void this.media.watch(broadcast));
    });
    effect((cleanup) => {
      const track = this.media.video(),
        element = this.video()?.nativeElement;
      if (track && element) {
        track.attach(element);
        cleanup(() => track.detach(element));
      }
    });
    effect((cleanup) => {
      const track = this.media.audio(),
        element = this.audio()?.nativeElement;
      if (track && element) {
        track.attach(element);
        cleanup(() => track.detach(element));
      }
    });
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
