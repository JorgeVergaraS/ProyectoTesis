import { Component, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MessageNotification } from '../../../core/models/demo';
import { CallNotificationService } from '../../../core/realtime/call-notification.service';

@Component({
  selector: 'nexo-message-notifications',
  imports: [DatePipe],
  template: `
    <details class="notification-inbox">
      <summary>
        Notificaciones
        @if (notifications().length) {
          · {{ notifications().length }} aviso{{ notifications().length === 1 ? '' : 's' }} de
          mensajes
        }
      </summary>
      <section class="notification-settings" aria-labelledby="call-notification-title">
        <div>
          <strong id="call-notification-title">Avisos de llamadas</strong>
          <p>Elige cómo quieres enterarte cuando alguien te llame.</p>
        </div>
        <label>
          <input
            type="checkbox"
            [checked]="callAlerts.ringtoneEnabled()"
            (change)="setRingtone($event)"
          />
          Sonido de llamada
        </label>
        <div class="notification-actions">
          <button type="button" (click)="testRingtone()">Probar sonido</button>
          @if (callAlerts.desktopEnabled()) {
            <button type="button" (click)="disableDesktopNotifications()">
              Desactivar avisos del navegador
            </button>
          } @else {
            <button type="button" (click)="enableDesktopNotifications()">
              Permitir avisos del navegador
            </button>
          }
        </div>
        <small aria-live="polite">
          @if (callAlerts.permission() === 'unsupported') {
            Este navegador no admite notificaciones del sistema; el aviso dentro de Nexo sigue
            disponible.
          } @else if (callAlerts.permission() === 'denied') {
            Los avisos están bloqueados por el navegador. Puedes habilitarlos desde los permisos del
            sitio.
          } @else if (callAlerts.soundNeedsGesture()) {
            El navegador bloqueó el sonido automático. Pulsa «Probar sonido» para activarlo.
          } @else if (callAlerts.desktopEnabled()) {
            Los avisos del navegador están activados. El nombre de quien llama no aparece en la
            notificación.
          } @else {
            El timbre se repite solo mientras hay una llamada entrante.
          }
        </small>
      </section>
      @if (notifications().length) {
        <ul>
          @for (notification of notifications(); track notification.messageId) {
            <li>
              <button type="button" [disabled]="busy()" (click)="opened.emit(notification)">
                <strong>{{ notification.senderName }}</strong>
                <span>Nuevo mensaje en {{ notification.conversationTitle }}</span>
                <small
                  >{{ notification.sentAt | date: 'dd/MM HH:mm' }} · Abrir y marcar aviso
                  leído</small
                >
              </button>
            </li>
          }
        </ul>
      }
    </details>
  `,
  styles: `
    :host {
      position: relative;
      z-index: 35;
      display: block;
      flex: 0 0 auto;
      min-width: 0;
    }
    .notification-inbox {
      position: relative;
      margin: 12px 20px 4px;
      padding: 0;
      border: 1px solid var(--theme-border-strong, #64748b);
      border-radius: 15px;
      color: inherit;
      background: color-mix(in srgb, var(--theme-panel, #111827) 94%, transparent);
      box-shadow: 0 8px 26px #00000012;
    }
    .notification-inbox summary {
      display: flex;
      align-items: center;
      min-height: 48px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      list-style-position: inside;
      user-select: none;
    }
    .notification-inbox[open] {
      position: fixed;
      top: 18px;
      right: 24px;
      width: min(440px, calc(100vw - 48px));
      max-height: calc(100dvh - 36px);
      overflow: auto;
      border-color: var(--theme-accent, #8b5cf6);
      background: var(--theme-panel, #111827);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #8b5cf6) 12%, transparent), 0 24px 64px #00000038;
    }
    .notification-inbox[open] summary {
      position: sticky;
      top: 0;
      z-index: 4;
      background: var(--theme-panel, #111827);
      border-radius: 15px 15px 0 0;
    }
    .notification-inbox[open] {
      border-color: var(--theme-accent, #8b5cf6);
    }
    .notification-inbox > section,
    .notification-inbox > ul {
      position: static;
      width: 100%;
      max-height: none;
      overflow: visible;
      margin: 0;
      border: 0;
      border-top: 1px solid var(--theme-border, #64748b);
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .notification-inbox > section {
      display: grid;
      gap: 12px;
      padding: 17px;
    }
    .notification-inbox > ul {
      padding: 8px;
      max-height: min(36dvh, 300px);
      overflow-y: auto;
    }
    .notification-settings {
      display: grid;
      gap: 10px;
      margin-top: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .notification-settings p,
    .notification-settings small {
      display: block;
      margin: 5px 0 0;
      color: var(--muted, #aab3c4);
      font-size: 12px;
      line-height: 1.5;
    }
    .notification-settings label,
    .notification-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .notification-settings input {
      accent-color: #9062db;
    }
    .notification-actions button {
      min-height: 38px;
      padding: 7px 11px;
      border: 1px solid var(--border, #64748b);
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .notification-actions button:hover {
      background: rgb(128 128 128 / 12%);
    }
    .notification-inbox ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .notification-inbox button {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 10px;
      background: transparent;
      color: inherit;
      border: 0;
      border-radius: 8px;
      text-align: left;
      cursor: pointer;
      overflow-wrap: anywhere;
    }
    .notification-inbox button:hover {
      background: rgb(128 128 128 / 12%);
    }
    .notification-inbox :focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }
    .notification-inbox button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    @media (max-width: 760px) {
      .notification-inbox {
        margin: 8px 12px 3px;
        border-radius: 12px;
      }
      .notification-inbox summary {
        min-height: 42px;
        padding-inline: 12px;
        font-size: 12px;
      }
      .notification-inbox > section,
      .notification-inbox > ul {
        width: 100%;
      }
      .notification-inbox[open] {
        top: 12px;
        right: 12px;
        left: 12px;
        width: auto;
        max-height: calc(100dvh - 24px);
      }
      .notification-inbox > ul {
        max-height: min(32dvh, 240px);
      }
    }
  `,
})
export class MessageNotificationsComponent {
  readonly callAlerts = inject(CallNotificationService);
  readonly notifications = input.required<MessageNotification[]>();
  readonly busy = input(false);
  readonly opened = output<MessageNotification>();

  setRingtone(event: Event): void {
    this.callAlerts.setRingtoneEnabled((event.target as HTMLInputElement).checked);
  }

  testRingtone(): void {
    void this.callAlerts.testRingtone();
  }

  enableDesktopNotifications(): void {
    void this.callAlerts.enableDesktopNotifications();
  }

  disableDesktopNotifications(): void {
    void this.callAlerts.disableDesktopNotifications();
  }
}
