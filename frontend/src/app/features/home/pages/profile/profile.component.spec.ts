import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { DemoUser } from '../../../../core/models/demo';
import { ProfileService } from '../../../../core/services/profile.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  const user: DemoUser = {
    id: '1',
    username: 'jorge@universidad.cl',
    displayName: 'Jorge',
    color: '#8b5cf6',
    bio: '',
    availability: 'AVAILABLE',
    online: true,
  };
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            session: { user: signal(user), kind: signal<'microsoft'>('microsoft') },
            logout: vi.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            update: vi.fn(() => of(user)),
            upload: vi.fn(() => of(user)),
            removeAvatar: vi.fn(() => of(user)),
          },
        },
      ],
    }),
  );
  it('shows the authenticated profile data', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jorge');
    expect(fixture.nativeElement.textContent).toContain('Microsoft Entra ID');
  });
});
