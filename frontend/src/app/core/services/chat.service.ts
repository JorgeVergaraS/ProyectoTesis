import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Conversation, DemoUser, Message, Workspace } from '../models/demo';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/demo';
  workspace() {
    return this.http.get<Workspace>(this.base + '/workspace');
  }
  messages(id: string) {
    return this.http.get<Message[]>(this.base + '/conversations/' + id + '/messages');
  }
  members(id: string) {
    return this.http.get<DemoUser[]>(this.base + '/conversations/' + id + '/members');
  }
  join(id: string) {
    return this.http.post<void>(this.base + '/conversations/' + id + '/membership', {});
  }
  leave(id: string) {
    return this.http.delete<void>(this.base + '/conversations/' + id + '/membership');
  }
  direct(userId: string) {
    return this.http.post<Conversation>(this.base + '/directs', { userId });
  }
  send(id: string, body: string, clientId: string) {
    return this.http.post<Message>(this.base + '/conversations/' + id + '/messages', {
      body,
      clientId,
    });
  }
}
