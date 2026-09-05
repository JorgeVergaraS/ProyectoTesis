import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DemoSessionStore } from '../auth/demo-session.store';
import { environment } from '../../../environments/environment';

export interface Broadcast {
  id: string;
  conversationId: string;
  hostId: string;
  title: string;
  sourceType: 'CAMERA' | 'SCREEN';
  status: 'DRAFT' | 'STARTING' | 'LIVE' | 'ENDED' | 'FAILED';
}
export interface BroadcastAccess {
  url: string;
  token: string;
  role: 'HOST' | 'VIEWER';
}

@Injectable({ providedIn: 'root' })
export class BroadcastApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(DemoSessionStore);
  private get base() {
    return environment.apiUrl + (this.session.kind() === 'demo' ? '/demo' : '');
  }
  config() {
    return this.http.get<{ enabled: boolean }>(this.base + '/broadcasts/config');
  }
  active(id: string) {
    return this.http.get<Broadcast[]>(`${this.base}/conversations/${id}/broadcasts/active`);
  }
  create(id: string, title: string, sourceType: 'CAMERA' | 'SCREEN') {
    return this.http.post<Broadcast>(`${this.base}/conversations/${id}/broadcasts`, {
      title,
      sourceType,
    });
  }
  access(id: string) {
    return this.http.post<BroadcastAccess>(`${this.base}/broadcasts/${id}/access`, {});
  }
  start(id: string) {
    return this.http.post<Broadcast>(`${this.base}/broadcasts/${id}/start`, {});
  }
  end(id: string) {
    return this.http.post<Broadcast>(`${this.base}/broadcasts/${id}/end`, {});
  }
}
