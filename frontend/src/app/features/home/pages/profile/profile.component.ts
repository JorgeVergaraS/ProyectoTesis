import { Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { PendingChangesAware } from '../../../../core/guards/pending-changes.guard';
import { DemoUser } from '../../../../core/models/demo';
import { ProfilePanelComponent } from '../../components/profile-panel.component';

@Component({
  selector: 'app-profile',
  imports: [ProfilePanelComponent],
  template: `
    <main class="profile-route">
      @if (auth.session.user(); as user) {
        <nexo-profile-panel
          [user]="user"
          [sessionKind]="auth.session.kind()"
          variant="page"
          (userChange)="updateUser($event)"
          (closed)="goHome()"
          (signOut)="logout()"
        />
      } @else {
        <p role="status">Cargando tu perfil…</p>
      }
    </main>
  `,
  styles: `
    .profile-route {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 24px;
      background: radial-gradient(circle at 20% 15%, #6d45c12e, transparent 32%), #090c13;
    }
    .profile-route > p {
      color: #9da7ba;
    }
    @media (max-width: 600px) {
      .profile-route {
        display: block;
        padding: 0;
      }
    }
  `,
})
export class ProfileComponent implements PendingChangesAware {
  readonly auth = inject(AuthService);
  readonly panel = viewChild(ProfilePanelComponent);
  private readonly router = inject(Router);

  canDeactivate(): boolean {
    return this.panel()?.confirmNavigation() ?? true;
  }

  updateUser(user: DemoUser): void {
    this.auth.session.user.set(user);
  }

  async goHome(): Promise<void> {
    await this.router.navigate(['/home']);
  }

  async logout(): Promise<void> {
    if (!this.canDeactivate()) return;
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
