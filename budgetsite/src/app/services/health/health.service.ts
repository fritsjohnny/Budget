// src/app/services/health.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval } from 'rxjs';
import { ApiUrls } from 'src/app/common/api-urls';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  constructor(private http: HttpClient) {}

  ping() {
    this.http.get(ApiUrls.health).subscribe({
        next: () => console.log('Ping enviado'),
        error: (err) => console.warn('Falha ao pingar a API: ' + err),
      });
  }

  startPing() {
    this.ping();

    // faz um ping a cada 5 minutos
    interval(300000).subscribe(() => {
      this.ping();
    });
  }
}
