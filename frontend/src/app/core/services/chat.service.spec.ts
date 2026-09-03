import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoSessionStore } from '../auth/demo-session.store';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let chat: ChatService;
  let http: HttpTestingController;
  let session: DemoSessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    chat = TestBed.inject(ChatService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(DemoSessionStore);
  });

  afterEach(() => http.verify());

  it('uses authenticated workspace routes for local and Microsoft sessions', () => {
    session.kind.set('local');
    chat.workspace().subscribe();
    http.expectOne('/api/workspace').flush({ channels: [], directs: [], people: [] });

    session.kind.set('microsoft');
    chat.messages('conversation-id').subscribe();
    http.expectOne('/api/conversations/conversation-id/messages').flush([]);
  });

  it('keeps the legacy demo route isolated to demo sessions', () => {
    session.kind.set('demo');
    chat.workspace().subscribe();
    http.expectOne('/api/demo/workspace').flush({ channels: [], directs: [], people: [] });
  });

  it('edits and deletes messages through the active session route', () => {
    session.kind.set('local');
    chat.edit('conversation-id', 'message-id', 'Texto editado').subscribe();
    const edit = http.expectOne('/api/conversations/conversation-id/messages/message-id');
    expect(edit.request.method).toBe('PATCH');
    expect(edit.request.body).toEqual({ body: 'Texto editado' });
    edit.flush({});

    session.kind.set('demo');
    chat.deleteMessage('conversation-id', 'message-id').subscribe();
    const remove = http.expectOne('/api/demo/conversations/conversation-id/messages/message-id');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
