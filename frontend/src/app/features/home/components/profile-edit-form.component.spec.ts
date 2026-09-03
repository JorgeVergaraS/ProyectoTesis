import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DemoUser } from '../../../core/models/demo';
import { ProfileService } from '../../../core/services/profile.service';
import { ProfileEditFormComponent } from './profile-edit-form.component';

describe('ProfileEditFormComponent', () => {
  const user: DemoUser = {
    id: '1',
    username: 'jean.old',
    displayName: 'Jean',
    color: '#8B5CF6',
    bio: 'Perfil anterior',
    availability: 'AVAILABLE',
    online: true,
  };
  const updated: DemoUser = {
    ...user,
    username: 'jean.nuevo',
    displayName: 'Jean Valenzuela',
    bio: 'Construyendo Nexo',
    color: '#38BDF8',
    availability: 'BUSY',
  };
  const profile = {
    update: vi.fn(() => of(updated)),
  };

  beforeEach(() => {
    profile.update.mockReset();
    profile.update.mockReturnValue(of(updated));
    TestBed.configureTestingModule({
      imports: [ProfileEditFormComponent],
      providers: [{ provide: ProfileService, useValue: profile }],
    });
  });

  it('normalizes valid fields and emits only the server response', async () => {
    const fixture = TestBed.createComponent(ProfileEditFormComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.saved.subscribe(emitted);
    component.form.patchValue({
      displayName: '  Jean Valenzuela  ',
      username: 'Jean.Nuevo',
      bio: '  Construyendo Nexo  ',
      color: '#38bdf8',
      availability: 'BUSY',
    });
    component.form.markAsDirty();

    await component.submit();

    expect(profile.update).toHaveBeenCalledWith({
      displayName: 'Jean Valenzuela',
      username: 'jean.nuevo',
      bio: 'Construyendo Nexo',
      color: '#38BDF8',
      availability: 'BUSY',
    });
    expect(emitted).toHaveBeenCalledWith(updated);
    expect(component.form.pristine).toBe(true);
  });

  it('keeps edits and marks the username when the server reports a conflict', async () => {
    profile.update.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
    );
    const fixture = TestBed.createComponent(ProfileEditFormComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.username.setValue('already.used');
    component.form.controls.username.markAsDirty();

    await component.submit();

    expect(component.form.controls.username.hasError('conflict')).toBe(true);
    expect(component.form.controls.username.value).toBe('already.used');
    expect(component.error()).toContain('ya está en uso');
  });

  it('does not submit invalid fields', async () => {
    const fixture = TestBed.createComponent(ProfileEditFormComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.displayName.setValue('   ');

    await fixture.componentInstance.submit();

    expect(profile.update).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.displayName.touched).toBe(true);
  });
});
