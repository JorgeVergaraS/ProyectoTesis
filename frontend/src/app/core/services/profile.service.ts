import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DemoUser } from '../models/demo';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<DemoUser>(environment.apiUrl + '/demo/me/avatar', body);
  }
  removeAvatar() {
    return this.http.delete<DemoUser>(environment.apiUrl + '/demo/me/avatar');
  }
}
