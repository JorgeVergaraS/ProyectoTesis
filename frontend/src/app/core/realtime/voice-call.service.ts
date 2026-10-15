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
  video: boolean;
  candidates?: SignaledIceCandidate[];
}

interface IceConfig {
  iceServers: RTCIceServer[];
}
interface SignaledIceCandidate extends Omit<RTCIceCandidateInit, 'candidate'> {
  candidate: string | null;
}

type CallSetupPhase = 'idle' | 'microphone' | 'ice' | 'gathering' | 'signaling';

@Injectable({ providedIn: 'root' })
export class VoiceCallService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(DemoSessionStore);
  private readonly studioMedia = inject(MediaDeviceService);
  private readonly callSessionId = this.readCallSessionId();
  readonly call = signal<VoiceCall | null>(null);
  readonly target = signal<DemoUser | null>(null);
  readonly busy = signal(false);
  readonly setupPhase = signal<CallSetupPhase>('idle');
  readonly waitingForMicrophone = signal(false);
  readonly muted = signal(false);
  readonly cameraEnabled = signal(false);
  readonly connection = signal<RTCPeerConnectionState>('new');
  readonly remoteStream = signal<MediaStream | null>(null);
  readonly remoteCameraEnabled = signal(false);
  readonly localStream = signal<MediaStream | null>(null);
  readonly notice = signal('');
  readonly error = signal('');
  readonly turnAvailable = signal(false);
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
  private remoteMediaStream: MediaStream | null = null;
  private videoSender: RTCRtpSender | null = null;
  private generation = 0;
  private localCallId: string | null = null;
  private dismissedId: string | null = null;
  private lastContact = Date.now();
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private iceConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private candidateFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCandidates: SignaledIceCandidate[] = [];
  private readonly appliedCandidates = new Set<string>();
  private signalingReady = false;
  private flushingCandidates = false;

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
          this.setupPhase.set('idle');
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
        FAILED: 'No se pudo establecer la llamada.',
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
        await this.withDeadline(
          peer.setRemoteDescription({ type: 'answer', sdp: next.answer }),
          10000,
        );
        this.watchIceConnection(peer);
        await this.applyRemoteCandidates(next, peer);
      } catch {
        await this.hangUp('No se pudo negociar el audio con la otra persona.');
      }
    } else if (peer?.remoteDescription) {
      await this.applyRemoteCandidates(next, peer);
    }
  }

  async start(
    person: DemoUser,
    conversationId: string | null = null,
    video = false,
  ): Promise<void> {
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
    this.pendingCandidates = [];
    this.appliedCandidates.clear();
    this.signalingReady = false;
    this.busy.set(true);
    this.setupPhase.set('microphone');
    this.target.set(person);
    this.error.set('');
    this.notice.set('');
    try {
      const peer = await this.preparePeer(operation, video);
      const offer = await this.description(
        peer,
        await this.withDeadline(peer.createOffer(), 10000),
      );
      this.assertCurrent(operation);
      this.setupPhase.set('signaling');
      const call = await firstValueFrom(
        this.http
          .post<VoiceCall>(
            this.base,
            { id, calleeId: person.id, conversationId, video, offer },
            this.requestOptions,
          )
          .pipe(timeout(10000)),
      );
      if (operation !== this.generation) {
        await this.endRemote(id);
        return;
      }
      this.call.set(call);
      this.signalingReady = true;
      this.scheduleCandidateFlush(0);
      await this.applyRemoteCandidates(call, peer);
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
      if (operation === this.generation) {
        this.busy.set(false);
        this.setupPhase.set('idle');
      }
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
    this.setupPhase.set('signaling');
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
      const peer = await this.preparePeer(operation, call.video);
      if (!call.offer) throw new Error('Missing offer');
      await this.withDeadline(peer.setRemoteDescription({ type: 'offer', sdp: call.offer }), 10000);
      this.signalingReady = true;
      this.scheduleCandidateFlush(0);
      await this.applyRemoteCandidates(accepted, peer);
      const answer = await this.description(
        peer,
        await this.withDeadline(peer.createAnswer(), 10000),
      );
      this.assertCurrent(operation);
      this.setupPhase.set('signaling');
      const updated = await firstValueFrom(
        this.http
          .post<VoiceCall>(this.base + '/' + call.id + '/answer', { answer }, this.requestOptions)
          .pipe(timeout(8000)),
      );
      if (operation === this.generation) {
        this.call.set(updated);
        this.watchIceConnection(peer);
      } else await this.endRemote(call.id);
    } catch (error) {
      if (operation === this.generation) await this.hangUp(this.mediaError(error));
    } finally {
      if (operation === this.generation) {
        this.busy.set(false);
        this.setupPhase.set('idle');
      }
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
    this.setupPhase.set('idle');
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
  async toggleCamera(): Promise<void> {
    if (!this.call()?.video || !this.peer || !this.videoSender || this.busy()) return;
    const track = this.microphone
      ?.getVideoTracks()
      .find((candidate) => candidate.readyState === 'live');
    if (track) {
      if (track.enabled) {
        await this.videoSender.replaceTrack(null);
        const current = this.microphone;
        if (current) {
          this.microphone = new MediaStream(current.getTracks().filter((item) => item !== track));
          track.stop();
          this.localStream.set(this.microphone);
        }
        this.cameraEnabled.set(false);
      } else {
        track.enabled = true;
        this.cameraEnabled.set(true);
      }
      return;
    }
    const peer = this.peer;
    let camera: MediaStream | null = null;
    this.busy.set(true);
    this.setupPhase.set('microphone');
    try {
      camera = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (this.peer !== peer || !this.microphone || !this.videoSender) {
        camera.getTracks().forEach((item) => item.stop());
        return;
      }
      const videoTrack = camera.getVideoTracks()[0];
      if (!videoTrack || !this.peer || !this.videoSender) {
        camera.getTracks().forEach((item) => item.stop());
        throw new Error('camera-unavailable');
      }
      await this.videoSender.replaceTrack(videoTrack);
      this.microphone?.addTrack(videoTrack);
      this.watchLocalCamera(videoTrack);
      this.localStream.set(this.microphone);
      this.cameraEnabled.set(true);
    } catch (error) {
      camera?.getTracks().forEach((item) => item.stop());
      this.error.set(this.cameraError(error));
    } finally {
      this.busy.set(false);
      this.setupPhase.set('idle');
    }
  }
  clearNotice(): void {
    this.notice.set('');
    this.error.set('');
  }

  private async preparePeer(operation: number, video = false): Promise<RTCPeerConnection> {
    this.setupPhase.set('microphone');
    this.waitingForMicrophone.set(true);
    let expired = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const request = navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: 'user',
            }
          : false,
      })
      .catch(async (videoError) => {
        if (!video || operation !== this.generation) throw videoError;
        // A denied or unavailable camera must not prevent the user from joining with audio.
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });
        this.notice.set(
          'La cámara no está disponible o no tiene permiso. La llamada seguirá solo con audio.',
        );
        return audioOnly;
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
    this.localStream.set(stream);
    this.cameraEnabled.set(stream.getVideoTracks().some((track) => track.enabled));
    this.setupPhase.set('ice');
    const iceServers = await this.iceServers();
    this.assertCurrent(operation);
    this.setupPhase.set('gathering');
    const peer = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: environment.voiceIceTransportPolicy,
      iceCandidatePoolSize: 4,
    });
    this.peer = peer;
    this.remoteMediaStream = new MediaStream();
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
    if (video) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        // Add the captured camera track itself so the sender is associated with
        // the media stream in SDP. This is more interoperable on mobile Safari
        // than creating an empty transceiver and replacing its track later.
        this.videoSender = peer.addTrack(videoTrack, stream);
        this.watchLocalCamera(videoTrack);
      } else {
        // Keep a bidirectional video m-line even when this side denied camera
        // access; the peer may still send video and this side may enable its
        // camera later during the call.
        this.videoSender = peer.addTransceiver('video', { direction: 'sendrecv' }).sender;
      }
    }
    peer.onicecandidate = (event) => {
      this.pendingCandidates.push(
        (event.candidate?.toJSON() ?? { candidate: null }) as SignaledIceCandidate,
      );
      this.scheduleCandidateFlush(event.candidate ? 100 : 0);
    };
    peer.ontrack = (event) => {
      if (this.peer !== peer) return;
      const tracks = this.remoteMediaStream ?? new MediaStream();
      this.remoteMediaStream = tracks;
      if (!tracks.getTracks().some((track) => track.id === event.track.id)) {
        tracks.addTrack(event.track);
      }
      const publish = () => {
        if (this.peer === peer && this.remoteMediaStream === tracks) {
          // Publish a new MediaStream identity for each track event so Angular
          // notices video arriving after audio, including on Safari/iOS where
          // the browser may reuse the same event stream for both tracks.
          this.remoteStream.set(new MediaStream(tracks.getTracks()));
          this.remoteCameraEnabled.set(
            tracks.getVideoTracks().some((track) => !track.muted && track.readyState !== 'ended'),
          );
        }
      };
      publish();
      event.track.onunmute = publish;
      event.track.onmute = publish;
      event.track.onended = () => {
        if (this.remoteMediaStream !== tracks) return;
        tracks.removeTrack(event.track);
        publish();
      };
    };
    peer.onconnectionstatechange = () => {
      if (this.peer !== peer) return;
      this.connection.set(peer.connectionState);
      if (peer.connectionState === 'connected') {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        if (this.iceConnectionTimer) clearTimeout(this.iceConnectionTimer);
        this.iceConnectionTimer = null;
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
          'No fue posible conectar la llamada. Revisa la red o prueba una conexión con TURN.',
        );
      } else if (peer.connectionState === 'disconnected' && !this.disconnectTimer) {
        this.disconnectTimer = setTimeout(() => {
          void this.hangUp('Se perdió la conexión de la llamada.');
        }, 15000);
      }
    };
    return peer;
  }
  private async description(
    peer: RTCPeerConnection,
    description: RTCSessionDescriptionInit,
  ): Promise<string> {
    await this.withDeadline(peer.setLocalDescription(description), 10000);
    if (!peer.localDescription?.sdp) throw new Error('Missing local description');
    return peer.localDescription.sdp;
  }
  private scheduleCandidateFlush(delay: number): void {
    if (!this.signalingReady || !this.localCallId || this.candidateFlushTimer) return;
    this.candidateFlushTimer = setTimeout(() => {
      this.candidateFlushTimer = null;
      void this.flushCandidates();
    }, delay);
  }
  private async flushCandidates(): Promise<void> {
    const id = this.localCallId;
    if (!id || !this.signalingReady || this.flushingCandidates || !this.pendingCandidates.length)
      return;
    this.flushingCandidates = true;
    const batch = this.pendingCandidates.splice(0, 32);
    try {
      await firstValueFrom(
        this.http
          .post(this.base + '/' + id + '/candidates', { candidates: batch }, this.requestOptions)
          .pipe(timeout(5000)),
      );
    } catch {
      if (this.localCallId === id) this.pendingCandidates.unshift(...batch);
    } finally {
      this.flushingCandidates = false;
      if (this.pendingCandidates.length) this.scheduleCandidateFlush(1000);
    }
  }
  private async applyRemoteCandidates(call: VoiceCall, peer: RTCPeerConnection): Promise<void> {
    for (const candidate of call.candidates ?? []) {
      const key = JSON.stringify(candidate);
      if (this.appliedCandidates.has(key) || !peer.remoteDescription) continue;
      this.appliedCandidates.add(key);
      try {
        await this.withDeadline(
          peer.addIceCandidate(candidate.candidate ? (candidate as RTCIceCandidateInit) : null),
          5000,
        );
      } catch {
        this.appliedCandidates.delete(key);
      }
    }
  }
  private watchIceConnection(peer: RTCPeerConnection): void {
    if (this.peer !== peer || peer.connectionState === 'connected' || this.iceConnectionTimer)
      return;
    this.iceConnectionTimer = setTimeout(() => {
      this.iceConnectionTimer = null;
      if (this.peer === peer && peer.connectionState !== 'connected') {
        void this.hangUp(
          'No se encontró una ruta de llamada. Comprueba la conexión móvil/Wi-Fi e inténtalo de nuevo.',
        );
      }
    }, 25000);
  }
  private async withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('WebRTC operation timed out')),
            milliseconds,
          );
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
  }
  private assertCurrent(operation: number): void {
    if (operation !== this.generation) throw new Error('Operation cancelled');
  }
  private watchLocalCamera(track: MediaStreamTrack): void {
    track.onended = () => {
      this.cameraEnabled.set(false);
      const current = this.microphone;
      if (!current) return;
      this.microphone = new MediaStream(current.getTracks().filter((item) => item !== track));
      this.localStream.set(this.microphone);
    };
  }
  private async iceServers(): Promise<RTCIceServer[]> {
    const fallback: RTCIceServer[] = [...environment.voiceIceServers];
    try {
      const config = await firstValueFrom(
        this.http.get<IceConfig>(this.base + '/ice-config').pipe(timeout(5000)),
      );
      const dynamic = Array.isArray(config?.iceServers) ? config.iceServers : [];
      if (!dynamic.length) {
        this.turnAvailable.set(this.hasTurnServer(fallback));
        return fallback;
      }
      const stunOnlyFallback = fallback.filter((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.every((url) => !url.startsWith('turn:') && !url.startsWith('turns:'));
      });
      const servers = [...stunOnlyFallback, ...dynamic];
      this.turnAvailable.set(this.hasTurnServer(servers));
      return servers;
    } catch {
      this.turnAvailable.set(this.hasTurnServer(fallback));
      return fallback;
    }
  }
  private hasTurnServer(servers: RTCIceServer[]): boolean {
    return servers.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'));
    });
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
    if (this.iceConnectionTimer) clearTimeout(this.iceConnectionTimer);
    this.iceConnectionTimer = null;
    if (this.candidateFlushTimer) clearTimeout(this.candidateFlushTimer);
    this.candidateFlushTimer = null;
    this.pendingCandidates = [];
    this.appliedCandidates.clear();
    this.signalingReady = false;
    this.flushingCandidates = false;
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
    }
    this.peer = null;
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.microphone = null;
    this.videoSender = null;
    this.remoteMediaStream?.getTracks().forEach((track) => {
      track.onmute = null;
      track.onunmute = null;
      track.onended = null;
    });
    this.remoteMediaStream = null;
    this.remoteCameraEnabled.set(false);
    this.localStream.set(null);
    this.cameraEnabled.set(false);
    this.remoteStream.set(null);
    this.muted.set(false);
    this.connection.set('new');
  }
  private mediaError(error: unknown): string {
    if (error instanceof Error && error.message === 'WebRTC operation timed out') {
      return 'La negociación de audio no respondió. Inténtalo de nuevo y, si persiste, cambia entre Wi-Fi y datos móviles.';
    }
    if (error instanceof Error && error.message === 'ICE timeout') {
      if (!this.turnAvailable()) {
        return 'Los dispositivos funcionan, pero Nexo no entregó un servidor TURN. Revisa la configuración de llamadas o inicia sesión de nuevo.';
      }
      return 'El micrófono está disponible, pero la negociación de red tardó demasiado. Comprueba tu conexión e inténtalo otra vez.';
    }
    if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name))
      return 'Permite el micrófono en el navegador para realizar la llamada.';
    if (error instanceof DOMException && error.name === 'NotFoundError')
      return 'No se encontró un micrófono.';
    return 'No se pudo iniciar el audio. Revisa tu micrófono, los permisos y la conexión.';
  }

  private cameraError(error: unknown): string {
    if (error instanceof DOMException && error.name === 'NotAllowedError')
      return 'La cámara está bloqueada. Permítela en los ajustes del sitio y vuelve a intentarlo.';
    if (error instanceof DOMException && error.name === 'NotFoundError')
      return 'No se encontró una cámara disponible en este dispositivo.';
    if (error instanceof DOMException && error.name === 'NotReadableError')
      return 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.';
    return 'No se pudo activar la cámara. La llamada de audio sigue activa.';
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
