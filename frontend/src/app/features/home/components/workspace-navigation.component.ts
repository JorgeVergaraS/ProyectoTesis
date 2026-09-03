import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSessionKind, DemoUser } from '../../../core/models/demo';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';
export type WorkspaceView = 'chat' | 'discover' | 'people' | 'overview';
@Component({
  selector: 'nexo-workspace-navigation',
  imports: [RouterLink, AvatarComponent, IconComponent],
  templateUrl: './workspace-navigation.component.html',
  styleUrl: './workspace-navigation.component.css',
})
export class WorkspaceNavigationComponent {
  readonly view = input.required<WorkspaceView>();
  readonly user = input<DemoUser | null>(null);
  readonly sessionKind = input<AuthSessionKind | null>(null);
  readonly busy = input(false);
  readonly navigate = output<WorkspaceView>();
  readonly profileOpen = output<void>();
  readonly signOut = output<void>();
  readonly sessionLabel = computed(() => {
    switch (this.sessionKind()) {
      case 'demo':
        return 'Demo local';
      case 'local':
        return 'Cuenta Nexo';
      default:
        return 'Microsoft Entra ID';
    }
  });
  readonly handle = computed(() => {
    const username = this.user()?.username ?? '';
    return username.includes('@') ? username : `@${username}`;
  });
}
