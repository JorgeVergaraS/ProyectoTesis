import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MessageNotification } from '../../../core/models/demo';

@Component({
  selector: 'nexo-message-notifications',
  imports: [DatePipe],
  template: `
    @if (notifications().length) {
      <details class="notification-inbox">
        <summary>
          Avisos de mensajes · {{ notifications().length }}
          {{ notifications().length === 1 ? 'pendiente' : 'pendientes'
          }}{{ notifications().length === 50 ? ' (últimos 50)' : '' }}
        </summary>
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
      </details>
    }
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
  readonly notifications = input.required<MessageNotification[]>();
  readonly busy = input(false);
  readonly opened = output<MessageNotification>();
}
