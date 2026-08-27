import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DemoAuthService } from '../../../../core/auth/demo-auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const auth = { choices: vi.fn(), login: vi.fn() };
  beforeEach(() => {
    auth.choices.mockReturnValue(
      of([
        {
          id: 'jorge',
          username: 'jorge',
          displayName: 'Jorge',
          color: '#8b5cf6',
          bio: 'Demo',
          online: false,
        },
        {
          id: 'jean',
          username: 'jean',
          displayName: 'Jean',
          color: '#38bdf8',
          bio: 'Demo',
          online: false,
        },
      ]),
    );
    auth.login.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: DemoAuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
  });
  it('shows real demo choices and enters with the selected profile', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jorge');
    expect(fixture.nativeElement.textContent).toContain('Jean');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.selected.setValue('jean');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(auth.login).toHaveBeenCalledWith('jean');
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });
  it('shows a recoverable login error', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.login.mockRejectedValueOnce(new Error('offline'));
    await fixture.componentInstance.enter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'No pudimos iniciar',
    );
    expect(fixture.componentInstance.busy()).toBe(false);
  });
});
