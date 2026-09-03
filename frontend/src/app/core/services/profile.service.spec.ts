import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoSessionStore } from '../auth/demo-session.store';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const user = {
    id: '1',
    username: 'jean.valenzuela',
    displayName: 'Jean',
    bio: 'Construyendo Nexo',
    color: '#8B5CF6',
    availability: 'AVAILABLE' as const,
    online: true,
  };
  let service: ProfileService;
  let http: HttpTestingController;
  let session: DemoSessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(DemoSessionStore);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('uses authenticated profile routes for local and Microsoft sessions', () => {
    const update = {
      displayName: 'Jean',
      username: 'jean.valenzuela',
      bio: 'Construyendo Nexo',
      color: '#8B5CF6',
      availability: 'AVAILABLE' as const,
    };

    session.kind.set('local');
    service.update(update).subscribe();
    const localUpdate = http.expectOne('/api/users/me/profile');
    expect(localUpdate.request.method).toBe('PATCH');
    localUpdate.flush(user);

    session.kind.set('microsoft');
    service.upload(new File(['avatar'], 'avatar.png', { type: 'image/png' })).subscribe();
    const upload = http.expectOne('/api/users/me/avatar');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBeInstanceOf(FormData);
    upload.flush(user);

    service.removeAvatar().subscribe();
    const remove = http.expectOne('/api/users/me/avatar');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(user);
  });

  it('keeps the compatibility routes isolated to demo sessions', () => {
    session.kind.set('demo');
    service
      .update({
        displayName: 'Jean',
        username: 'jean',
        bio: '',
        color: '#8B5CF6',
        availability: 'AWAY',
      })
      .subscribe();
    const update = http.expectOne('/api/demo/me/profile');
    expect(update.request.method).toBe('PATCH');
    update.flush(user);

    service.removeAvatar().subscribe();
    const remove = http.expectOne('/api/demo/me/avatar');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(user);
  });
});
