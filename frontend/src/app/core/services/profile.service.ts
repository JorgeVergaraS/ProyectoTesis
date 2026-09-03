import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from '../auth/demo-session.store';
import { DemoUser, ProfileAvailability } from '../models/demo';

export interface ProfileUpdate {
  displayName: string;
  username: string;
  bio: string;
  color: string;
  availability: ProfileAvailability;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(DemoSessionStore);

  private get ownProfileUrl(): string {
    return environment.apiUrl + (this.session.kind() === 'demo' ? '/demo/me' : '/users/me');
  }

  update(profile: ProfileUpdate) {
    return this.http.patch<DemoUser>(this.ownProfileUrl + '/profile', profile);
  }

  upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<DemoUser>(this.ownProfileUrl + '/avatar', body);
  }

  removeAvatar() {
    return this.http.delete<DemoUser>(this.ownProfileUrl + '/avatar');
  }
}
