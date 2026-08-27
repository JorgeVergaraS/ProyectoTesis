import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HealthResponse } from '../models/health-response';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  check(): Observable<HealthResponse> {
    return this.http
      .get<HealthResponse>(`${environment.apiUrl}/public/health`)
      .pipe(timeout(10000));
  }
}
