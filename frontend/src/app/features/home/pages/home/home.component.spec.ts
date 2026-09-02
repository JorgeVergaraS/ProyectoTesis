import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { DemoUser, Workspace } from '../../../../core/models/demo';
import { VoiceCallService } from '../../../../core/realtime/voice-call.service';
import { ChatService } from '../../../../core/services/chat.service';
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
  const workspace: Workspace = {
    channels: [
      {
        id: 'general-id',
        kind: 'CHANNEL',
        title: 'general',
        description: 'Comunidad general',
        slug: 'general',
        joined: true,
        memberCount: 1,
        peerId: null,
      },
    ],
    directs: [],
    people: [user],
  };
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HomeComponent],
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
          provide: ChatService,
          useValue: {
            workspace: vi.fn(() => of(workspace)),
            messages: vi.fn(() => of([])),
            members: vi.fn(() => of([user])),
          },
        },
        {
          provide: VoiceCallService,
          useValue: { occupied: signal(false), hangUp: vi.fn() },
        },
      ],
    }),
  );
  it('loads the real workspace for an authenticated Microsoft user', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HomeComponent);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jorge');
    expect(fixture.nativeElement.textContent).toContain('Microsoft Entra ID');
    expect(fixture.nativeElement.textContent).toContain('general');
    fixture.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
