import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { DemoUser, ProfileAvailability } from '../../../core/models/demo';
import { ProfileService, ProfileUpdate } from '../../../core/services/profile.service';

@Component({
  selector: 'nexo-profile-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-edit-form.component.html',
  styleUrl: './profile-edit-form.component.css',
})
export class ProfileEditFormComponent implements AfterViewInit {
  readonly user = input.required<DemoUser>();
  readonly saved = output<DemoUser>();
  readonly cancelRequested = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly displayNameInput = viewChild<ElementRef<HTMLInputElement>>('displayNameInput');
  readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120), Validators.pattern(/.*\S.*/s)],
    }),
    username: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(254),
        Validators.pattern(/^[A-Za-z0-9](?:[A-Za-z0-9._@+\-]*[A-Za-z0-9])?$/),
      ],
    }),
    bio: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(250)],
    }),
    color: new FormControl('#8B5CF6', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    }),
    availability: new FormControl<ProfileAvailability>('AVAILABLE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => this.load(this.user()));
    this.form.controls.username.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.removeUsernameConflict());
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.displayNameInput()?.nativeElement.focus());
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  markDiscarded(): void {
    this.form.markAsPristine();
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.displayNameInput()?.nativeElement.focus();
      return;
    }

    this.busy.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const update: ProfileUpdate = {
      displayName: value.displayName.trim(),
      username: value.username.trim().toLowerCase(),
      bio: value.bio.trim(),
      color: value.color.toUpperCase(),
      availability: value.availability,
    };

    try {
      const user = await firstValueFrom(this.profile.update(update));
      this.load(user);
      this.saved.emit(user);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.form.controls.username.setErrors({
          ...this.form.controls.username.errors,
          conflict: true,
        });
        this.form.controls.username.markAsTouched();
        this.error.set('Ese nombre de usuario ya está en uso. Prueba con otro.');
      } else if (error instanceof HttpErrorResponse && error.status === 400) {
        this.error.set('Revisa los campos marcados antes de guardar.');
      } else {
        this.error.set('No pudimos guardar los cambios. Tu formulario permanece intacto.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  private load(user: DemoUser): void {
    this.form.reset(
      {
        displayName: user.displayName,
        username: user.username,
        bio: user.bio,
        color: user.color.toUpperCase(),
        availability: user.availability ?? 'AVAILABLE',
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();
    this.error.set('');
  }

  private removeUsernameConflict(): void {
    const errors = this.form.controls.username.errors;
    if (!errors?.['conflict']) return;
    const { conflict: _conflict, ...remaining } = errors;
    this.form.controls.username.setErrors(Object.keys(remaining).length ? remaining : null);
    this.error.set('');
  }
}
