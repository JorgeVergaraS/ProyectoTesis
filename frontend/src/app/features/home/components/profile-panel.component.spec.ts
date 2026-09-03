import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MediaDeviceService } from '../../../core/media/media-device.service';
import { DemoUser } from '../../../core/models/demo';
import { VoiceCallService } from '../../../core/realtime/voice-call.service';
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
  const studioMedia = {
    stream: signal<MediaStream | null>(null),
    source: signal(null),
    audioInputs: signal([]),
    videoInputs: signal([]),
    selectedAudioId: signal(''),
    selectedVideoId: signal(''),
    microphoneMuted: signal(false),
    audioLevel: signal(0),
    stopReason: signal(null),
    cameraSupported: true,
    screenSupported: true,
    start: vi.fn(),
    changeMicrophone: vi.fn(),
    changeCamera: vi.fn(),
    toggleMicrophone: vi.fn(),
    stop: vi.fn(),
  };

  beforeEach(() => {
    profile.update.mockClear();
    profile.upload.mockClear();
    profile.removeAvatar.mockClear();
    TestBed.configureTestingModule({
      imports: [ProfilePanelComponent],
      providers: [
        { provide: ProfileService, useValue: profile },
        { provide: MediaDeviceService, useValue: studioMedia },
        { provide: VoiceCallService, useValue: { occupied: signal(false) } },
      ],
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

  it('opens the private multimedia studio from the profile', () => {
    const fixture = TestBed.createComponent(ProfilePanelComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();

    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item: HTMLButtonElement) => item.textContent.includes('Preparar transmisión'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('studio');
    expect(fixture.nativeElement.querySelector('nexo-broadcast-studio')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('vista previa privada');
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

  it('keeps keyboard focus inside the profile dialog', async () => {
    const fixture = TestBed.createComponent(ProfilePanelComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    await Promise.resolve();
    const component = fixture.componentInstance;
    const lastButton = fixture.nativeElement.querySelector('.sign-out') as HTMLButtonElement;
    lastButton.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    component.onDocumentKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(component.closeButton()?.nativeElement);
  });

  it('restores focus to the control that opened the profile', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const fixture = TestBed.createComponent(ProfilePanelComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    await Promise.resolve();

    fixture.componentInstance.requestClose();
    await Promise.resolve();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
