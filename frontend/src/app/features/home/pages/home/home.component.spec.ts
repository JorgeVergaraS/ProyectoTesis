import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { DemoUser } from '../../../../core/models/demo';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
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
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { session: { user: signal(user) }, logout: vi.fn() } },
      ],
    }),
  );
  it('shows the authenticated user', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jorge');
    expect(fixture.nativeElement.textContent).toContain('Microsoft Entra ID');
  });
});
