import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { VoiceCallService } from '../../core/realtime/voice-call.service';
import { AvatarComponent } from './avatar.component';
import { IconComponent } from './icon.component';

@Component({
  selector: 'nexo-voice-call-panel',
  imports: [AvatarComponent, IconComponent],
  template: `
    <audio #remoteAudio autoplay></audio>
    @if (voice.occupied()) {
      <section class="voice-panel" aria-label="Llamada de voz">
        <header>
          <span><nexo-icon name="phone" /> LLAMADA DE VOZ</span
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
          @if (voice.error()) {
            <p class="call-error" role="alert">{{ voice.error() }}</p>
          }
          @if (voice.call()?.status === 'RINGING' && !voice.call()?.outgoing && !voice.busy()) {
            <p class="call-help">Te está llamando. Al aceptar se solicitará acceso al micrófono.</p>
            <div class="call-actions">
              <button class="accept" (click)="voice.accept()">Aceptar llamada</button
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
              <button class="hangup" (click)="voice.hangUp()">Finalizar</button>
            </div>
            @if (audioBlocked()) {
              <button class="primary-button audio-unlock" (click)="playAudio()">
                Activar audio recibido
              </button>
            }
          }
          <p class="call-help">
            Usa audífonos si pruebas dos sesiones en el mismo equipo. Solo audio; sin grabación.
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
      width: 340px;
      max-width: calc(100vw - 28px);
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
      margin: 0;
      font-size: 19px;
      font-weight: 550;
    }
    .call-person p {
      font-size: 12px;
      color: #b8d7ce;
      margin: 7px 0 0;
    }
    .call-actions {
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .call-actions button {
      flex: 1;
      min-height: 40px;
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
    .audio-unlock {
      margin-top: 12px;
      width: 100%;
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
  `,
})
export class VoiceCallPanelComponent {
  readonly voice = inject(VoiceCallService);
  readonly minimized = signal(false);
  readonly audioBlocked = signal(false);
  readonly audio = viewChild<ElementRef<HTMLAudioElement>>('remoteAudio');
  constructor() {
    effect(() => {
      const element = this.audio()?.nativeElement;
      const stream = this.voice.remoteStream();
      if (!element) return;
      element.srcObject = stream;
      if (stream) void this.playAudio();
      else {
        if (!element.paused) element.pause();
        this.audioBlocked.set(false);
      }
    });
  }
  status(): string {
    if (this.voice.waitingForMicrophone()) return 'Esperando permiso del micrófono…';
    if (this.voice.busy()) return 'Preparando micrófono y conexión…';
    if (this.voice.connection() === 'connected')
      return 'Audio conectado · ' + this.voice.duration();
    if (this.voice.connection() === 'disconnected') return 'Reconectando audio…';
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
}
