import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoUser } from '../../../core/models/demo';
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
  readonly busy = input(false);
  readonly navigate = output<WorkspaceView>();
  readonly signOut = output<void>();
}
