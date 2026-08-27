import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { DemoAuthService } from '../../../../core/auth/demo-auth.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { VoiceCallService } from '../../../../core/realtime/voice-call.service';
import { DemoUser } from '../../../../core/models/demo';

describe('Profile photo', () => {
  const user = signal<DemoUser>({
    id: 'jorge',
    username: 'jorge',
    displayName: 'Jorge',
    color: '#8b5cf6',
    bio: '',
    online: true,
  });
  const profiles = { upload: vi.fn(), removeAvatar: vi.fn() };
  beforeEach(() => {
    user.set({ ...user(), avatarUrl: null });
    profiles.upload.mockReset();
    profiles.removeAvatar.mockReset();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: DemoAuthService, useValue: { session: { user } } },
        { provide: ProfileService, useValue: profiles },
        { provide: VoiceCallService, useValue: { occupied: signal(false) } },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());
  function choose(component: ProfileComponent, file: File) {
    component.choosePhoto({ target: { files: [file], value: 'image' } } as unknown as Event);
  }
  it('validates the selection before uploading and retains the old photo on failure', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    choose(component, new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }));
    expect(component.photoError()).toContain('JPG o PNG');
    expect(component.preview()).toBe('');
    choose(component, new File(['png'], 'photo.png', { type: 'image/png' }));
    profiles.upload.mockReturnValue(throwError(() => new Error('offline')));
    await component.savePhoto();
    expect(user().avatarUrl).toBeNull();
    expect(component.preview()).toBe('blob:preview');
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
  it('updates the signed-in profile after upload and can restore initials by removing the photo', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    choose(component, new File(['png'], 'photo.png', { type: 'image/png' }));
    profiles.upload.mockReturnValue(of({ ...user(), avatarUrl: '/api/demo/avatars/123/456' }));
    await component.savePhoto();
    expect(user().avatarUrl).toBe('/api/demo/avatars/123/456');
    expect(component.preview()).toBe('');
    profiles.removeAvatar.mockReturnValue(of({ ...user(), avatarUrl: null }));
    await component.removePhoto();
    expect(user().avatarUrl).toBeNull();
    expect(component.photoNotice()).toContain('iniciales');
    fixture.destroy();
  });
});
