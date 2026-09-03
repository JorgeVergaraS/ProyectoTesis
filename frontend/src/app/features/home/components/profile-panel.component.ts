import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthSessionKind, DemoUser } from '../../../core/models/demo';
import { ProfileService } from '../../../core/services/profile.service';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ProfileEditFormComponent } from './profile-edit-form.component';

@Component({
  selector: 'nexo-profile-panel',
  imports: [AvatarComponent, IconComponent, ProfileEditFormComponent],
  templateUrl: './profile-panel.component.html',
  styleUrl: './profile-panel.component.css',
})
export class ProfilePanelComponent implements AfterViewInit {
  readonly user = input.required<DemoUser>();
  readonly sessionKind = input<AuthSessionKind | null>(null);
  readonly variant = input<'drawer' | 'page'>('drawer');
  readonly closed = output<void>();
  readonly userChange = output<DemoUser>();
  readonly signOut = output<void>();
  readonly mode = signal<'profile' | 'edit'>('profile');
  readonly uploading = signal(false);
  readonly removing = signal(false);
  readonly avatarError = signal('');
  readonly savedMessage = signal('');
  readonly editForm = viewChild(ProfileEditFormComponent);
  readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  readonly availabilityLabel = computed(() => {
    switch (this.user().availability ?? 'AVAILABLE') {
      case 'BUSY':
        return 'Ocupado';
      case 'AWAY':
        return 'Ausente';
      default:
        return 'Disponible';
    }
  });
  readonly handle = computed(() => {
    const username = this.user().username;
    return username.includes('@') ? username : `@${username}`;
  });
  readonly providerLabel = computed(() => {
    switch (this.sessionKind()) {
      case 'demo':
        return 'Demostración local';
      case 'local':
        return 'Cuenta local Nexo';
      default:
        return 'Microsoft Entra ID';
    }
  });
  private readonly profile = inject(ProfileService);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.closeButton()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mode() === 'edit') this.returnToProfile();
    else this.requestClose();
  }

  @HostListener('window:beforeunload', ['$event'])
  protectBrowserNavigation(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  openEdit(): void {
    this.avatarError.set('');
    this.savedMessage.set('');
    this.mode.set('edit');
  }

  returnToProfile(): void {
    if (!this.confirmDiscard()) return;
    this.editForm()?.markDiscarded();
    this.mode.set('profile');
    queueMicrotask(() => this.closeButton()?.nativeElement.focus());
  }

  requestClose(): void {
    if (this.uploading() || this.removing() || this.editForm()?.busy()) return;
    if (!this.confirmDiscard()) return;
    this.editForm()?.markDiscarded();
    this.mode.set('profile');
    this.closed.emit();
  }

  confirmNavigation(): boolean {
    if (this.uploading() || this.removing() || this.editForm()?.busy()) return false;
    return this.confirmDiscard();
  }

  profileSaved(user: DemoUser): void {
    this.userChange.emit(user);
    this.savedMessage.set('Cambios guardados correctamente.');
    this.mode.set('profile');
  }

  async uploadAvatar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      this.avatarError.set('Usa una imagen PNG o JPG de máximo 2 MB.');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.avatarError.set('');
    this.savedMessage.set('');
    try {
      const user = await firstValueFrom(this.profile.upload(file));
      this.userChange.emit(user);
      this.savedMessage.set('La foto de perfil se actualizó.');
    } catch (error: unknown) {
      this.avatarError.set(this.avatarMessage(error));
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async removeAvatar(): Promise<void> {
    if (this.removing() || this.uploading()) return;
    this.removing.set(true);
    this.avatarError.set('');
    this.savedMessage.set('');
    try {
      const user = await firstValueFrom(this.profile.removeAvatar());
      this.userChange.emit(user);
      this.savedMessage.set('La foto se quitó; ahora se muestran tus iniciales.');
    } catch {
      this.avatarError.set('No pudimos quitar la foto. Inténtalo nuevamente.');
    } finally {
      this.removing.set(false);
    }
  }

  private hasUnsavedChanges(): boolean {
    return this.mode() === 'edit' && !!this.editForm()?.hasUnsavedChanges();
  }

  private confirmDiscard(): boolean {
    return (
      !this.hasUnsavedChanges() ||
      window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?')
    );
  }

  private avatarMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 413)
      return 'La imagen supera el máximo de 2 MB.';
    if (error instanceof HttpErrorResponse && error.status === 415)
      return 'El archivo no contiene una imagen PNG o JPG válida.';
    return 'No pudimos guardar la foto. Inténtalo nuevamente.';
  }
}
