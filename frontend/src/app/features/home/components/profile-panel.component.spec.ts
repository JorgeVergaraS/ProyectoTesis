import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DemoUser } from '../../../core/models/demo';
import { ProfileService } from '../../../core/services/profile.service';
import { ProfilePanelComponent } from './profile-panel.component';

describe('ProfilePanelComponent', () => {
  const user: DemoUser = {
    id: '1',
    username: 'jean.valenzuela',
    displayName: 'Jean Valenzuela',
    color: '#8B5CF6',
    bio: 'Construyendo Nexo',
    availability: 'AVAILABLE',
    online: true,
    email: 'jean@nexo.cl',
  };
  const profile = {
    update: vi.fn(() => of(user)),
    upload: vi.fn(() => of({ ...user, avatarUrl: '/api/avatars/1/2' })),
    removeAvatar: vi.fn(() => of({ ...user, avatarUrl: null })),
  };

  beforeEach(() => {
    profile.update.mockClear();
    profile.upload.mockClear();
    profile.removeAvatar.mockClear();
    TestBed.configureTestingModule({
      imports: [ProfilePanelComponent],
      providers: [{ provide: ProfileService, useValue: profile }],
    });
  });

  it('renders the persisted profile and its identity provider', () => {
    const fixture = TestBed.createComponent(ProfilePanelComponent);
    fixture.componentRef.setInput('user', user);
    fixture.componentRef.setInput('sessionKind', 'local');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jean Valenzuela');
    expect(fixture.nativeElement.textContent).toContain('Disponible');
    expect(fixture.nativeElement.textContent).toContain('Cuenta local Nexo');
  });

  it('asks before discarding an edited form', () => {
    const fixture = TestBed.createComponent(ProfilePanelComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const closed = vi.fn();
    component.closed.subscribe(closed);
    component.openEdit();
    fixture.detectChanges();
    component.editForm()?.form.controls.bio.setValue('Cambio pendiente');
    component.editForm()?.form.controls.bio.markAsDirty();
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.requestClose();
    expect(closed).not.toHaveBeenCalled();
    expect(component.mode()).toBe('edit');

    confirmation.mockReturnValue(true);
    component.requestClose();
    expect(closed).toHaveBeenCalledOnce();
    confirmation.mockRestore();
  });

  it('rejects an unsupported avatar before sending it', async () => {
    const fixture = TestBed.createComponent(ProfilePanelComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    const target = {
      files: [new File(['avatar'], 'avatar.webp', { type: 'image/webp' })],
      value: 'selected',
    };

    await fixture.componentInstance.uploadAvatar({ target } as unknown as Event);

    expect(profile.upload).not.toHaveBeenCalled();
    expect(fixture.componentInstance.avatarError()).toContain('PNG o JPG');
    expect(target.value).toBe('');
  });
});
