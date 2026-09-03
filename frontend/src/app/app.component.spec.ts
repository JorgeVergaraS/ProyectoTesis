import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { of } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { VoiceCallService } from './core/realtime/voice-call.service';
import { App } from './app.component';

describe('App', () => {
  it('creates the application router shell', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: MsalService, useValue: { handleRedirectObservable: () => of(null) } },
        { provide: AuthService, useValue: { completeRedirect: vi.fn().mockResolvedValue(false) } },
        {
          provide: VoiceCallService,
          useValue: {
            occupied: signal(false),
            notice: signal(''),
            error: signal(''),
            remoteStream: signal(null),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });
});
