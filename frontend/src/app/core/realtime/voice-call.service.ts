import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  exhaustMap,
  firstValueFrom,
  from,
  switchMap,
  timer,
  timeout,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from '../auth/demo-session.store';
import { MediaDeviceService } from '../media/media-device.service';
import { DemoUser } from '../models/demo';

export interface VoiceCall {
  id: string;
  peer: DemoUser;
  outgoing: boolean;
  status: 'RINGING' | 'CONNECTING' | 'ACTIVE' | 'ENDED';
  reason: string | null;
  offer: string | null;
  answer: string | null;
  connectedAt: string | null;
  conversationId: string | null;
}

interface IceConfig {
  iceServers: RTCIceServer[];
}

@Injectable({ providedIn: 'root' })
export class VoiceCallService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(DemoSessionStore);
  private readonly studioMedia = inject(MediaDeviceService);
  private readonly callSessionId = this.readCallSessionId();
  readonly call = signal<VoiceCall | null>(null);
  readonly target = signal<DemoUser | null>(null);
  readonly busy = signal(false);
  readonly waitingForMicrophone = signal(false);
  readonly muted = signal(false);
  readonly connection = signal<RTCPeerConnectionState>('new');
  readonly remoteStream = signal<MediaStream | null>(null);
  readonly notice = signal('');
  readonly error = signal('');
  readonly available =
    typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  readonly occupied = computed(() => this.busy() || !!this.call());
  readonly mediaInUse = computed(() => !!this.studioMedia.stream());
  readonly now = signal(Date.now());
  private readonly authenticatedSession = computed(() => {
    const kind = this.session.kind();
    const user = this.session.user();
    if (!kind || !user) return null;
    if (kind === 'microsoft') return `microsoft:${user.id}`;
    const token = this.session.token();
    return token ? `${kind}:${user.id}:${token}` : null;
  });
  private get base(): string {
    return environment.apiUrl + (this.session.kind() === 'demo' ? '/demo' : '') + '/calls';
  }
  private get requestOptions() {
    return { headers: { 'X-Nexo-Call-Session': this.callSessionId } };
  }
  readonly duration = computed(() => {
    const started = this.call()?.connectedAt;
    const seconds = started
      ? Math.max(0, Math.floor((this.now() - Date.parse(started)) / 1000))
      : 0;
    return (
      Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0') +
      ':' +
      (seconds % 60).toString().padStart(2, '0')
    );
  });
  private peer: RTCPeerConnection | null = null;
  private microphone: MediaStream | null = null;
  private generation = 0;
  private localCallId: string | null = null;
  private dismissedId: string | null = null;
  private lastContact = Date.now();
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    toObservable(this.authenticatedSession)
      .pipe(
        switchMap((identity) => {
          this.generation++;
          this.releaseMedia();
          this.call.set(null);
          this.target.set(null);
          this.busy.set(false);
          this.localCallId = null;
          this.dismissedId = null;
          this.notice.set('');
          this.error.set('');
          if (!identity) return EMPTY;
          this.lastContact = Date.now();
          return timer(0, 1500).pipe(
            exhaustMap(() =>
              from(this.poll(identity)).pipe(
                catchError(() => {
                  if (this.call() && Date.now() - this.lastContact > 20000) {
                    void this.hangUp('Se perdió la conexión con Nexo. La llamada terminó.');
                  }
                  return EMPTY;
                }),
              ),
            ),
          );
        }),
        takeUntilDestroyed(destroy),
      )
      .subscribe();
    timer(0, 1000)
      .pipe(takeUntilDestroyed(destroy))
      .subscribe(() => this.now.set(Date.now()));
    destroy.onDestroy(() => {
      this.generation++;
      this.releaseMedia();
    });
  }

  private async poll(identity: string): Promise<void> {
    const generation = this.generation;
    const wasBusy = this.busy();
    const next = await firstValueFrom(
      this.http
        .get<VoiceCall | null>(this.base + '/current', this.requestOptions)
        .pipe(timeout(8000)),
    );
    if (identity !== this.authenticatedSession()) return;
    this.lastContact = Date.now();
    if (wasBusy || this.busy() || generation !== this.generation) return;
    if (!next) {
      if (this.call()) await this.hangUp('La llamada terminó o fue atendida en otra pestaña.');
      return;
    }
    if (next.id === this.dismissedId) return;
    if (next.status === 'ENDED') {
      this.dismissedId = next.id;
      this.generation++;
      this.releaseMedia();
      this.call.set(null);
      this.target.set(null);
      this.localCallId = null;
      const reasons: Record<string, string> = {
        REJECTED: 'Llamada rechazada.',
        MISSED: 'No hubo respuesta.',
        FAILED: 'No se pudo establecer el audio.',
        DISCONNECTED: 'La otra sesión se desconectó.',
      };
      this.notice.set(reasons[next.reason ?? ''] ?? 'Llamada finalizada.');
      return;
    }
    if ((next.outgoing || next.status !== 'RINGING') && this.localCallId !== next.id) {
      this.call.set(next);
      await this.hangUp('La llamada se interrumpió al recargar o cambiar de pestaña.');
      return;
    }
    this.call.set(next);
    this.target.set(next.peer);
    const peer = this.peer;
    if (next.outgoing && next.answer && peer && !peer.remoteDescription) {
      try {
        await peer.setRemoteDescription({ type: 'answer', sdp: next.answer });
      } catch {
        await this.hangUp('No se pudo negociar el audio con la otra persona.');
      }
    }
  }

  async start(person: DemoUser, conversationId: string | null = null): Promise<void> {
    if (this.occupied()) return;
    if (this.mediaInUse()) {
      this.error.set('Cierra el estudio multimedia antes de iniciar una llamada de voz.');
      return;
    }
    if (!this.available) {
      this.error.set(
        'Este navegador no permite llamadas. Abre Nexo con HTTPS en un navegador compatible.',
      );
      return;
    }
    const operation = ++this.generation;
    const id = crypto.randomUUID();
    this.localCallId = id;
    this.busy.set(true);
    this.target.set(person);
    this.error.set('');
    this.notice.set('');
    try {
      const peer = await this.preparePeer(operation);
      const offer = await this.description(peer, await peer.createOffer());
      this.assertCurrent(operation);
      const call = await firstValueFrom(
        this.http
          .post<VoiceCall>(
            this.base,
            { id, calleeId: person.id, conversationId, offer },
            this.requestOptions,
          )
          .pipe(timeout(10000)),
      );
      if (operation !== this.generation) {
        await this.endRemote(id);
        return;
      }
      this.call.set(call);
    } catch (error) {
      if (operation === this.generation) {
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 409
            ? 'Uno de los usuarios ya está en otra llamada.'
            : this.mediaError(error),
        );
        this.releaseMedia();
        this.target.set(null);
        this.localCallId = null;
        await this.endRemote(id);
      }
    } finally {
      if (operation === this.generation) this.busy.set(false);
    }
  }

  async accept(): Promise<void> {
    const call = this.call();
    if (!call || call.outgoing || call.status !== 'RINGING' || this.busy()) return;
    if (this.mediaInUse()) {
      this.error.set('Cierra el estudio multimedia antes de aceptar la llamada.');
      return;
    }
    if (!this.available) {
      this.error.set('Tu navegador no permite acceso al micrófono para esta llamada.');
      return;
    }
    const operation = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.localCallId = call.id;
    try {
      const accepted = await firstValueFrom(
        this.http
          .post<VoiceCall>(this.base + '/' + call.id + '/accept', {}, this.requestOptions)
          .pipe(timeout(8000)),
      );
      if (operation !== this.generation) {
        await this.endRemote(call.id);
        return;
      }
      if (accepted.status === 'ENDED') throw new Error('Call ended');
      this.call.set(accepted);
      const peer = await this.preparePeer(operation);
      if (!call.offer) throw new Error('Missing offer');
      await peer.setRemoteDescription({ type: 'offer', sdp: call.offer });
      const answer = await this.description(peer, await peer.createAnswer());
      this.assertCurrent(operation);
      const updated = await firstValueFrom(
        this.http
          .post<VoiceCall>(this.base + '/' + call.id + '/answer', { answer }, this.requestOptions)
          .pipe(timeout(8000)),
      );
      if (operation === this.generation) this.call.set(updated);
      else await this.endRemote(call.id);
    } catch (error) {
      if (operation === this.generation) await this.hangUp(this.mediaError(error));
    } finally {
      if (operation === this.generation) this.busy.set(false);
    }
  }

  async reject(): Promise<void> {
    const call = this.call();
    if (!call || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.http
          .post(this.base + '/' + call.id + '/reject', {}, this.requestOptions)
          .pipe(timeout(8000)),
      );
      this.dismissedId = call.id;
      this.call.set(null);
      this.target.set(null);
      this.notice.set('Llamada rechazada.');
    } catch {
      this.error.set('No se pudo rechazar la llamada. Inténtalo otra vez.');
    } finally {
      this.busy.set(false);
    }
  }

  async hangUp(message = ''): Promise<void> {
    const id = this.localCallId ?? this.call()?.id;
    this.generation++;
    this.releaseMedia();
    this.busy.set(false);
    this.call.set(null);
    this.target.set(null);
    this.localCallId = null;
    if (id) this.dismissedId = id;
    this.notice.set(message || 'Llamada finalizada.');
    if (id) await this.endRemote(id);
  }
  toggleMute(): void {
    this.muted.set(!this.muted());
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted();
    });
  }
  clearNotice(): void {
    this.notice.set('');
    this.error.set('');
  }

  private async preparePeer(operation: number): Promise<RTCPeerConnection> {
    this.waitingForMicrophone.set(true);
    let expired = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const request = navigator.mediaDevices
      .getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      .then((stream) => {
        if (expired || operation !== this.generation) {
          stream.getTracks().forEach((track) => track.stop());
          throw new DOMException('Microphone request cancelled', 'AbortError');
        }
        return stream;
      });
    let stream: MediaStream;
    try {
      stream = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => {
            expired = true;
            reject(new DOMException('Microphone permission timed out', 'NotAllowedError'));
          }, 30000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
      if (operation === this.generation) this.waitingForMicrophone.set(false);
    }
    if (operation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Operation cancelled');
    }
    this.microphone = stream;
    const peer = new RTCPeerConnection({
      iceServers: await this.iceServers(),
      iceTransportPolicy: environment.voiceIceTransportPolicy,
    });
    this.peer = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      if (this.peer === peer)
        this.remoteStream.set(event.streams[0] ?? new MediaStream([event.track]));
    };
    peer.onconnectionstatechange = () => {
      if (this.peer !== peer) return;
      this.connection.set(peer.connectionState);
      if (peer.connectionState === 'connected') {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        const id = this.localCallId;
        if (id)
          void firstValueFrom(
            this.http
              .post(this.base + '/' + id + '/connected', {}, this.requestOptions)
              .pipe(timeout(8000)),
          ).catch(() => {
            void this.hangUp('No se pudo confirmar la conexión.');
          });
      } else if (peer.connectionState === 'failed') {
        void this.hangUp(
          'No fue posible conectar el audio. Revisa la red o prueba una conexión con TURN.',
        );
      } else if (peer.connectionState === 'disconnected' && !this.disconnectTimer) {
        this.disconnectTimer = setTimeout(() => {
          void this.hangUp('Se perdió la conexión de audio.');
        }, 15000);
      }
    };
    return peer;
  }
  private async description(
    peer: RTCPeerConnection,
    description: RTCSessionDescriptionInit,
  ): Promise<string> {
    await peer.setLocalDescription(description);
    if (peer.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          clearTimeout(timerId);
          peer.removeEventListener('icegatheringstatechange', changed);
        };
        const changed = () => {
          if (peer.iceGatheringState === 'complete') {
            finish();
            resolve();
          }
        };
        const timerId = setTimeout(() => {
          finish();
          reject(new Error('ICE timeout'));
        }, 10000);
        peer.addEventListener('icegatheringstatechange', changed);
        changed();
      });
    }
    if (!peer.localDescription?.sdp) throw new Error('Missing local description');
    return peer.localDescription.sdp;
  }
  private assertCurrent(operation: number): void {
    if (operation !== this.generation) throw new Error('Operation cancelled');
  }
  private async iceServers(): Promise<RTCIceServer[]> {
    const fallback: RTCIceServer[] = [...environment.voiceIceServers];
    if (this.session.kind() === 'demo') return fallback;
    try {
      const config = await firstValueFrom(
        this.http.get<IceConfig>(this.base + '/ice-config').pipe(timeout(5000)),
      );
      return [...fallback, ...(Array.isArray(config?.iceServers) ? config.iceServers : [])];
    } catch {
      return fallback;
    }
  }
  private async endRemote(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(this.base + '/' + id + '/end', {}, this.requestOptions).pipe(timeout(5000)),
      );
    } catch {
      /* Server expires abandoned calls via participant heartbeats. */
    }
  }
  private releaseMedia(): void {
    this.waitingForMicrophone.set(false);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    if (this.peer) {
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
    }
    this.peer = null;
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.microphone = null;
    this.remoteStream.set(null);
    this.muted.set(false);
    this.connection.set('new');
  }
  private mediaError(error: unknown): string {
    if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name))
      return 'Permite el micrófono en el navegador para realizar la llamada.';
    if (error instanceof DOMException && error.name === 'NotFoundError')
      return 'No se encontró un micrófono.';
    return 'No se pudo iniciar el audio. Revisa tu micrófono, los permisos y la conexión.';
  }

  private readCallSessionId(): string {
    const key = 'nexo.call.session-id';
    try {
      const saved = sessionStorage.getItem(key);
      if (
        saved &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)
      )
        return saved;
      const created = crypto.randomUUID();
      sessionStorage.setItem(key, created);
      return created;
    } catch {
      return crypto.randomUUID();
    }
  }
}
