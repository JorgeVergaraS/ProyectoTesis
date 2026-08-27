import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HealthService } from '../../../../core/services/health.service';

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrl: './status.component.css',
})
export class StatusComponent implements OnInit {
  private readonly health = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = signal<'loading' | 'up' | 'error'>('loading');
  readonly checkedAt = signal<string | null>(null);

  ngOnInit(): void {
    this.checkHealth();
  }

  checkHealth(): void {
    this.state.set('loading');
    this.health
      .check()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.state.set(
            response.status === 'UP' && response.service === 'nexo-backend' ? 'up' : 'error',
          );
          this.checkedAt.set(new Date().toLocaleTimeString('es-CL'));
        },
        error: () => {
          this.state.set('error');
          this.checkedAt.set(new Date().toLocaleTimeString('es-CL'));
        },
      });
  }
}
