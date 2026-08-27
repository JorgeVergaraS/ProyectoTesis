import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home.component';
import { ChatService } from '../../../../core/services/chat.service';
import { DemoAuthService } from '../../../../core/auth/demo-auth.service';
import { VoiceCallService } from '../../../../core/realtime/voice-call.service';
import { Conversation, DemoUser, Message } from '../../../../core/models/demo';

describe('HomeComponent message flow', () => {
  let fixture: ComponentFixture<HomeComponent>;
  const user: DemoUser = {
    id: 'jorge',
    username: 'jorge',
    displayName: 'Jorge',
    color: '#8b5cf6',
    bio: 'Demo',
    online: true,
  };
  const channel: Conversation = {
    id: 'general',
    kind: 'CHANNEL',
    title: 'general',
    description: 'Demo',
    slug: 'general',
    joined: true,
    memberCount: 1,
    peerId: null,
  };
  const message: Message = {
    id: 'message',
    conversationId: 'general',
    senderId: 'jorge',
    senderName: 'Jorge',
    senderColor: '#8b5cf6',
    body: 'Hola',
    sentAt: '2026-08-27T10:00:00Z',
  };
  const chat = { workspace: vi.fn(), messages: vi.fn(), members: vi.fn(), send: vi.fn() };
  beforeEach(async () => {
    vi.useFakeTimers();
    chat.workspace.mockReturnValue(of({ channels: [channel], directs: [], people: [user] }));
    chat.messages.mockReturnValue(of([]));
    chat.members.mockReturnValue(of([user]));
    chat.send.mockReset();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: ChatService, useValue: chat },
        {
          provide: VoiceCallService,
          useValue: { occupied: signal(false), available: true, start: vi.fn() },
        },
        { provide: DemoAuthService, useValue: { session: { user: signal(user) } } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });
  it('submits the real composer without navigating and retains the retry key on failure', async () => {
    chat.send
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(of(message));
    fixture.componentInstance.draft.setValue('Hola');
    fixture.detectChanges();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    await Promise.resolve();
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.draft.value).toBe('Hola');
    const clientId = chat.send.mock.calls[0][2];
    await fixture.componentInstance.send();
    expect(chat.send.mock.calls[1][2]).toBe(clientId);
    expect(fixture.componentInstance.draft.value).toBe('');
  });
  it('preserves a draft when switching channels', () => {
    fixture.componentInstance.draft.setValue('Mi borrador');
    fixture.componentInstance.select({ ...channel, id: 'other', title: 'other' });
    expect(fixture.componentInstance.draft.value).toBe('');
    fixture.componentInstance.select(channel);
    expect(fixture.componentInstance.draft.value).toBe('Mi borrador');
  });
  it('renders incoming and outgoing bubbles using the authenticated sender', () => {
    fixture.componentInstance.messages.set([
      message,
      { ...message, id: 'reply', senderId: 'jean', senderName: 'Jean', body: 'Hola Jorge' },
    ]);
    fixture.detectChanges();
    const bubbles = fixture.nativeElement.querySelectorAll('.message-row');
    expect(bubbles[0].classList.contains('own-message')).toBe(true);
    expect(bubbles[1].classList.contains('own-message')).toBe(false);
    expect(bubbles[1].textContent).toContain('Jean');
    expect(bubbles[1].textContent).toContain('Hola Jorge');
  });
  it('renders clickable links in sent and received messages, preserving the original text', () => {
    const body = 'Mira https://example.com/buscar?q=nexo&lang=es#ideas,\n(www.example.org).';
    fixture.componentInstance.messages.set([
      { ...message, body },
      { ...message, id: 'reply', senderId: 'jean', body: 'http://localhost:4200/status' },
    ]);
    fixture.detectChanges();
    const messages = fixture.nativeElement.querySelectorAll('nexo-message-text');
    expect(messages[0].textContent).toBe(body);
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.message-bubble a'),
    );
    expect(links.map((link) => link.href)).toEqual([
      'https://example.com/buscar?q=nexo&lang=es#ideas',
      'https://www.example.org/',
      'http://localhost:4200/status',
    ]);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(link.getAttribute('aria-label')).toContain('abre en otra pestaña');
    }
  });
  it.each([
    [
      'Consulta (https://example.com/wiki/Nexo_(proyecto)).',
      'https://example.com/wiki/Nexo_(proyecto)',
    ],
    ['HTTP://EXAMPLE.COM/ruta!', 'http://example.com/ruta'],
    ['https://example.com/uno\nhttps://example.com/dos', 'https://example.com/uno'],
  ])('handles prose punctuation and balanced URL parentheses: %s', (body, href) => {
    fixture.componentInstance.messages.set([{ ...message, body }]);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('nexo-message-text');
    expect(content.textContent).toBe(body);
    expect(content.querySelector('a').href).toBe(href);
  });
  it.each([
    'javascript:alert(1) data:text/html,test file:///etc/passwd',
    '<img src=x onerror=alert(1)><script>alert(1)</script>',
    'https:// https://[invalid www.',
    'https://trusted.example@evil.example https://user:password@example.com',
    'javascript:https://example.com correo@www.example.com',
    'https://example.com/\u202eevil https://example.com\\@evil.example',
  ])('keeps unsafe or invalid content as plain text: %s', (body) => {
    fixture.componentInstance.messages.set([{ ...message, body }]);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('nexo-message-text');
    expect(content.textContent).toBe(body);
    expect(content.querySelector('a, img, script')).toBeNull();
  });
  it('filters the inbox by type and search without changing the active conversation', () => {
    const component = fixture.componentInstance;
    component.workspace.set({
      channels: [channel, { ...channel, id: 'hidden', title: 'No unido', joined: false }],
      directs: [],
      people: [user, { ...user, id: 'jean', displayName: 'Jean' }],
    });
    fixture.detectChanges();
    const inbox = fixture.nativeElement.querySelector('nexo-conversation-inbox');
    expect(inbox.querySelectorAll('.conversation-item').length).toBe(2);
    const filters = inbox.querySelectorAll('.inbox-filters button');
    filters[1].click();
    fixture.detectChanges();
    expect(inbox.querySelectorAll('.conversation-item').length).toBe(1);
    expect(inbox.querySelector('.conversation-item').textContent).toContain('Jean');
    component.filter.setValue('nadie');
    fixture.detectChanges();
    expect(inbox.querySelectorAll('.conversation-item').length).toBe(0);
    expect(component.activeId()).toBe('general');
    component.filter.setValue(' GENERAL ');
    filters[2].click();
    fixture.detectChanges();
    expect(inbox.querySelectorAll('.conversation-item').length).toBe(1);
    expect(inbox.querySelector('.conversation-item').textContent).toContain('general');
  });
  it('navigates through the new menu and restores a draft after visiting the overview', () => {
    const component = fixture.componentInstance;
    component.draft.setValue('Idea para el grupo');
    fixture.nativeElement.querySelector('.primary-navigation button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overview-page h1').textContent).toContain('Jorge');
    const buttons = fixture.nativeElement.querySelectorAll('.primary-navigation button');
    buttons[2].click();
    fixture.detectChanges();
    expect(component.inboxOpen()).toBe(true);
    fixture.nativeElement.querySelector('.conversation-item').click();
    fixture.detectChanges();
    expect(component.inboxOpen()).toBe(false);
    expect(component.draft.value).toBe('Idea para el grupo');
  });
});
