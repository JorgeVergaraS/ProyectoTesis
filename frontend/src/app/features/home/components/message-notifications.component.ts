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
      display: contents;
    }
    .notification-inbox {
      margin: 12px 20px;
      padding: 12px 16px;
      border: 1px solid var(--border, #64748b);
      border-radius: 12px;
      color: inherit;
      flex-shrink: 0;
    }
    .notification-inbox summary {
      cursor: pointer;
      font-weight: 600;
    }
    .notification-settings {
      display: grid;
      gap: 10px;
      margin-top: 12px;
      padding: 12px;
      border: 1px solid var(--border, #64748b);
      border-radius: 10px;
      background: rgb(128 128 128 / 7%);
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
      margin: 12px 0 0;
      padding: 0;
      max-height: 240px;
      overflow-y: auto;
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
