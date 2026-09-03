import { CanDeactivateFn } from '@angular/router';

export interface PendingChangesAware {
  canDeactivate(): boolean;
}

export const pendingChangesGuard: CanDeactivateFn<PendingChangesAware> = (component) =>
  component.canDeactivate();
