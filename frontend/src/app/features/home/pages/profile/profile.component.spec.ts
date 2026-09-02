import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { DemoUser } from '../../../../core/models/demo';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  const user: DemoUser = {
    id: '1',
    username: 'jorge@universidad.cl',
    displayName: 'Jorge',
    color: '#8b5cf6',
    bio: '',
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
