import { Component, inject, input, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer, exhaustMap } from 'rxjs';
import { Broadcast, BroadcastApiService } from '../../../core/media/broadcast-api.service';
import { BroadcastViewerComponent } from './broadcast-viewer.component';
import { DemoSessionStore } from '../../../core/auth/demo-session.store';

@Component({
  selector: 'nexo-conversation-broadcasts',
  imports: [BroadcastViewerComponent],
  template: `
    @for (broadcast of broadcasts(); track broadcast.id) {
      <section class="live-card">
        <span>EN VIVO · {{ broadcast.title }}</span>
        @if (broadcast.hostId === session.user()?.id) {
          <small>Tu transmisión está activa</small>
        } @else {
          <button
            class="secondary-button"
            (click)="selected.set(selected()?.id === broadcast.id ? null : broadcast)"
          >
            {{ selected()?.id === broadcast.id ? 'Cerrar reproductor' : 'Ver transmisión' }}
          </button>
        }
      </section>
    }
    @if (selected(); as broadcast) {
      <nexo-broadcast-viewer [broadcast]="broadcast" />
    }
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .live-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 16px;
        border-bottom: 1px solid currentColor;
        flex-wrap: wrap;
      }
      .live-card span {
        font-size: 0.85rem;
        font-weight: 600;
      }
      .live-card small {
        font-size: 0.75rem;
      }
      p {
        padding: 8px 16px;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class ConversationBroadcastsComponent {
  readonly conversationId = input.required<string>();
  readonly broadcasts = signal<Broadcast[]>([]);
  readonly selected = signal<Broadcast | null>(null);
  readonly notice = signal('');
  readonly session = inject(DemoSessionStore);
  private readonly api = inject(BroadcastApiService);
  constructor() {
    toObservable(this.conversationId)
      .pipe(
        switchMap((id) => {
          this.selected.set(null);
          this.broadcasts.set([]);
          this.notice.set('');
          return timer(0, 4000).pipe(
            exhaustMap(() => this.api.active(id).pipe(catchError(() => of(null)))),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((items) => {
        if (items === null) {
          this.notice.set('No se pudo consultar las transmisiones. Reintentando…');
          return;
        }
        this.notice.set('');
        this.broadcasts.set(items);
        if (this.selected() && !items.some((item) => item.id === this.selected()!.id)) {
          this.selected.set(null);
          this.notice.set('La transmisión finalizó.');
        }
      });
  }
}
