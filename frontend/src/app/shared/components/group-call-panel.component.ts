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
          <button
            class="icon-button"
            [attr.aria-label]="minimized() ? 'Expandir llamada grupal' : 'Minimizar llamada grupal'"
            [attr.aria-pressed]="minimized()"
            (click)="minimized.set(!minimized())"
          >
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
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .actions button {
      min-width: 0;
      flex: 1;
      min-height: 44px;
    }
    header span {
      font-size: 10px;
      letter-spacing: 1px;
      color: #c1afe4;
    }
    h2 {
      margin: 14px 0 6px;
      font-size: 19px;
      overflow-wrap: anywhere;
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
      min-width: 0;
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
        left: max(8px, env(safe-area-inset-left));
        right: max(8px, env(safe-area-inset-right));
        bottom: max(8px, env(safe-area-inset-bottom));
        width: auto;
        max-height: calc(
          100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))
        );
        padding: 12px;
      }
    }
    @media (orientation: landscape) and (max-height: 520px) {
      .group-panel {
        top: max(8px, env(safe-area-inset-top));
        bottom: max(8px, env(safe-area-inset-bottom));
        max-height: none;
      }
      h2 {
        margin-top: 8px;
        font-size: 16px;
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
