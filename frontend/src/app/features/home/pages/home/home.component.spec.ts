import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BroadcastApiService } from '../../../../core/media/broadcast-api.service';
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
  const otherUser: DemoUser = {
    id: '2',
    username: 'jean@universidad.cl',
    displayName: 'Jean',
    color: '#0ea5e9',
    bio: 'Estudiante',
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
      {
        id: 'development-id',
        kind: 'CHANNEL',
        title: 'desarrollo',
        description: 'Proyectos y código',
        slug: 'desarrollo',
        joined: true,
        memberCount: 1,
        peerId: null,
      },
    ],
    directs: [],
    people: [user, otherUser],
  };
  const ownMessage = {
    id: 'message-id',
    conversationId: 'general-id',
    senderId: '1',
    senderName: 'Jorge',
    senderColor: '#8b5cf6',
    body: 'Mensaje original',
    sentAt: '2026-09-03T00:00:00Z',
  };
  const chat = {
    workspace: vi.fn(() => of(workspace)),
    messages: vi.fn(() => of([])),
    members: vi.fn(() => of([user])),
    send: vi.fn(() => of({ ...ownMessage, id: 'sent-id' })),
    edit: vi.fn((_conversation: string, _message: string, body: string) =>
      of({ ...ownMessage, body }),
    ),
    deleteMessage: vi.fn(() => of(undefined)),
  };
  const calls = { occupied: signal(false), start: vi.fn(), hangUp: vi.fn() };
  beforeEach(() => {
    Object.values(chat).forEach((mock) => mock.mockClear());
    calls.start.mockClear();
    calls.hangUp.mockClear();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: BroadcastApiService, useValue: { active: () => of([]) } },
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
          useValue: chat,
        },
        {
          provide: VoiceCallService,
          useValue: calls,
        },
      ],
    });
  });
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

  it('offers voice calls to other authenticated users', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HomeComponent);
    await vi.advanceTimersByTimeAsync(0);
    fixture.componentInstance.navigate('people');
    fixture.detectChanges();

    const callButton = fixture.nativeElement.querySelector(
      '.call-person-button',
    ) as HTMLButtonElement;
    expect(callButton).toBeTruthy();
    expect(callButton.textContent).toContain('Llamar');

    callButton.click();

    expect(calls.start).toHaveBeenCalledWith(otherUser);
    fixture.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('edits and deletes only the current user message', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HomeComponent);
    await vi.advanceTimersByTimeAsync(0);
    const component = fixture.componentInstance;
    component.messages.set([ownMessage]);
    component.startEdit(ownMessage);
    component.draft.setValue('Mensaje editado');

    await component.send();

    expect(chat.edit).toHaveBeenCalledWith('general-id', 'message-id', 'Mensaje editado');
    expect(component.messages()[0].body).toBe('Mensaje editado');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.deleteMessage(component.messages()[0]);

    expect(chat.deleteMessage).toHaveBeenCalledWith('general-id', 'message-id');
    expect(component.messages()).toEqual([]);
    fixture.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('creates contextual replies and forwards to another joined conversation', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HomeComponent);
    await vi.advanceTimersByTimeAsync(0);
    const component = fixture.componentInstance;
    component.startReply(ownMessage);
    component.draft.setValue('Esta es mi respuesta');

    await component.send();

    expect(chat.send).toHaveBeenCalledWith(
      'general-id',
      expect.stringContaining('Respuesta a Jorge: “Mensaje original”'),
      expect.any(String),
    );

    component.toggleForward(ownMessage);
    await component.forwardTo(workspace.channels[1]);

    expect(chat.send).toHaveBeenLastCalledWith(
      'development-id',
      'Reenviado de Jorge:\nMensaje original',
      expect.any(String),
    );
    fixture.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
