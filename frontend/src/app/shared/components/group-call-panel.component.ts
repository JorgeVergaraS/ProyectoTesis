import { Component, inject, signal } from '@angular/core';
import { GroupCallService } from '../../core/realtime/group-call.service';
import { IconComponent } from './icon.component';
import { BroadcastStudioComponent } from '../../features/home/components/broadcast-studio.component';
import { ConversationBroadcastsComponent } from '../../features/home/components/conversation-broadcasts.component';

@Component({
  selector: 'nexo-group-call-panel',
  imports: [IconComponent, BroadcastStudioComponent, ConversationBroadcastsComponent],
  template: `
    @if (group.occupied() && group.state() !== 'ERROR') {
      <section class="group-panel" aria-label="Llamada grupal">
        <header>
          <span><nexo-icon name="phone" /> LLAMADA GRUPAL</span>
          <button class="icon-button" (click)="minimized.set(!minimized())">
            <nexo-icon name="chevron" />
          </button>
        </header>
        <h2># {{ group.title() }}</h2>
        <p role="status">{{ status() }}</p>
        @if (!minimized()) {
          <p>{{ group.participants() }} participante(s) conectados</p>
          <div class="actions">
            <button class="secondary-button" (click)="group.toggleMute()">
              <nexo-icon name="mic" />{{ group.muted() ? 'Activar micrófono' : 'Silenciar' }}
            </button>
            <button class="hangup" (click)="group.leave()">Salir</button>
          </div>
          @if (group.audioBlocked()) {
            <button class="primary-button unlock" (click)="group.unlockAudio()">
              Activar audio recibido
            </button>
          }
          <details class="group-broadcasts">
            <summary>Transmitir en esta llamada grupal</summary>
            <nexo-broadcast-studio [inCall]="true" [conversationId]="group.conversationId()" />
            <nexo-conversation-broadcasts [conversationId]="group.conversationId()" />
          </details>
          <small>Audio multiusuario mediante LiveKit · Sin grabación</small>
        }
      </section>
    } @else if (group.error()) {
      <div class="group-toast" role="alert">
        {{ group.error() }}
        <button class="icon-button" (click)="group.clearError()"><nexo-icon name="close" /></button>
      </div>
    }
  `,
  styles: `
    .group-panel,
    .group-toast {
      position: fixed;
      z-index: 70;
      right: 24px;
      bottom: 24px;
      box-sizing: border-box;
      width: min(420px, calc(100vw - 28px));
      padding: 18px;
      border: 1px solid #665084;
      border-radius: 19px;
      background: linear-gradient(145deg, #181529, #0b1420);
      box-shadow: 0 15px 70px #000b;
    }
    header,
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .actions button {
      flex: 1;
      min-height: 40px;
    }
    header span {
      font-size: 10px;
      letter-spacing: 1px;
      color: #c1afe4;
    }
    h2 {
      margin: 14px 0 6px;
      font-size: 19px;
    }
    p,
    small {
      color: #aac0c8;
    }
    .hangup {
      background: #a22c49;
      color: #fff;
      border: 0;
      border-radius: 9px;
    }
    .unlock {
      width: 100%;
      margin-top: 10px;
    }
    .group-broadcasts {
      margin-top: 12px;
      border-top: 1px solid #665084;
      padding-top: 10px;
    }
    .group-broadcasts summary {
      cursor: pointer;
      color: #cfb5ff;
      font-size: 12px;
    }
    .group-broadcasts nexo-broadcast-studio,
    .group-broadcasts nexo-conversation-broadcasts {
      display: block;
      margin-top: 10px;
    }
    small {
      display: block;
      margin-top: 14px;
      font-size: 10px;
    }
    @media (max-width: 480px) {
      .group-panel,
      .group-toast {
        left: 10px;
        right: 10px;
        bottom: 10px;
        width: auto;
        max-height: calc(100dvh - 20px);
        overflow: auto;
        padding: 12px;
      }
    }
  `,
})
export class GroupCallPanelComponent {
  readonly group = inject(GroupCallService);
  readonly minimized = signal(false);
  status(): string {
    if (this.group.state() === 'CONNECTING') return 'Conectando micrófono y sala…';
    if (this.group.state() === 'RECONNECTING') return 'Reconectando…';
    return 'Audio conectado';
  }
}
