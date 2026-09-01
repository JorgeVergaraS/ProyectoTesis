import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const auth = { isConfigured: true, login: vi.fn() };
  beforeEach(() => {
    auth.login.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
  });
  it('renders the Microsoft login action', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Continuar con Microsoft');
  });
  it('starts the MSAL login flow', async () => {
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    await component.enter();
    expect(auth.login).toHaveBeenCalledOnce();
  });
});
