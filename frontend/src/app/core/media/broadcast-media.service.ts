import { Injectable, OnDestroy, inject, signal, isDevMode } from '@angular/core';
import { firstValueFrom, retry, timer, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import type { Room, RemoteTrack } from 'livekit-client';
import { Broadcast, BroadcastApiService } from './broadcast-api.service';
import { BroadcastFrameRate } from './media-device.service';

export interface BroadcastPublishOptions {
  frameRate?: BroadcastFrameRate;
  audioEnabled?: boolean;
}

// Component-scoped: leaving a studio/viewer always disconnects its room.
@Injectable()
export class BroadcastMediaService implements OnDestroy {
  private readonly api = inject(BroadcastApiService);
  readonly state = signal<'IDLE' | 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'ENDED' | 'ERROR'>(
    'IDLE',
  );
  readonly error = signal('');
  readonly audioBlocked = signal(false);
  readonly video = signal<RemoteTrack | null>(null);
  readonly audio = signal<RemoteTrack | null>(null);
  private room: Room | null = null;
  private hostId = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private version = 0;

  async publish(
    conversation: string,
    title: string,
    source: 'CAMERA' | 'SCREEN',
    stream: MediaStream,
    options: BroadcastPublishOptions = {},
  ) {
    const version = ++this.version;
    this.state.set('CONNECTING');
    this.error.set('');
    let created: Broadcast | null = null;
    try {
      created = await firstValueFrom(this.api.create(conversation, title, source));
      if (version !== this.version) {
        await firstValueFrom(this.api.end(created.id));
        return;
      }
      this.hostId = created.id;
      const room = await this.connect(created.id, version, 'HOST');
      const { Track } = await import('livekit-client');
      const frameRate = options.frameRate ?? 30;
      let screenAudioPending = source === 'SCREEN' && stream.getAudioTracks().length > 1;
      for (const track of stream.getTracks()) {
        this.check(version);
        if (track.kind === 'audio' && options.audioEnabled === false) continue;
        if (track.readyState === 'ended') throw new Error('Dispositivo desconectado');
        await room.localParticipant.publishTrack(track, {
          source:
            track.kind === 'audio'
              ? screenAudioPending
                ? ((screenAudioPending = false), Track.Source.ScreenShareAudio)
                : Track.Source.Microphone
              : source === 'SCREEN'
                ? Track.Source.ScreenShare
                : Track.Source.Camera,
          simulcast: track.kind === 'video',
          videoCodec: 'vp8',
          ...(track.kind === 'video'
            ? {
                videoEncoding: {
                  maxFramerate: frameRate,
                  maxBitrate:
                    frameRate === 60 ? 6_000_000 : frameRate === 30 ? 3_000_000 : 1_500_000,
                },
              }
            : {}),
        });
      }
      this.check(version);
      await firstValueFrom(
        this.api.start(created.id).pipe(
          retry({
            count: 4,
            delay: (error) =>
              error instanceof HttpErrorResponse && error.status === 409
                ? timer(500)
                : throwError(() => error),
          }),
        ),
      );
      this.check(version);
      this.state.set('LIVE');
      let renewing = false;
      const renew = async () => {
        if (renewing || version !== this.version) return;
        renewing = true;
        try {
          await firstValueFrom(this.api.start(created!.id));
        } catch {
          if (version === this.version) {
            await this.stop();
            this.error.set('Se perdió la conexión con la transmisión. Vuelve a prepararla.');
            this.state.set('ERROR');
          }
        } finally {
          renewing = false;
        }
      };
      this.timer = setInterval(() => void renew(), 20000);
    } catch (error) {
      if (isDevMode() && error instanceof Error)
        console.warn('Broadcast connection:', error.name, error.message.split('?')[0]);
      if (version !== this.version) return;
      await this.stop();
      this.state.set('ERROR');
      this.error.set(
        'No se pudo iniciar la transmisión. Revisa la conexión y que no tengas otra emisión abierta.',
      );
    }
  }

  async watch(broadcast: Broadcast) {
    const stopping = this.stop();
    await stopping;
    const version = this.version;
    if (version !== this.version) return;
    this.error.set('');
    this.state.set('CONNECTING');
    try {
      await this.connect(broadcast.id, version, 'VIEWER');
      this.check(version);
      this.state.set('LIVE');
    } catch {
      if (version !== this.version) return;
      await this.stop();
      this.state.set('ERROR');
      this.error.set(
        'No se pudo abrir la transmisión. Comprueba que siga en vivo e inténtalo nuevamente.',
      );
    }
  }

  private async connect(id: string, version: number, role: 'HOST' | 'VIEWER') {
    const { Room, RoomEvent } = await import('livekit-client');
    this.check(version);
    const access = await firstValueFrom(this.api.access(id));
    this.check(version);
    if (access.role !== role) throw new Error('Rol no válido');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room.on(RoomEvent.Reconnecting, () => {
      if (this.room === room) this.state.set('RECONNECTING');
    });
    room.on(RoomEvent.Reconnected, () => {
      if (this.room === room) this.state.set('LIVE');
    });
    room.on(RoomEvent.Disconnected, () => {
      if (this.room !== room) return;
      if (this.state() === 'CONNECTING') return;
      void this.stop();
      this.state.set('ENDED');
    });
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (this.room !== room) return;
      if (track.kind === 'video') this.video.set(track);
      else if (track.kind === 'audio') this.audio.set(track);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
      if (this.video() === track) this.video.set(null);
      if (this.audio() === track) this.audio.set(null);
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (this.room === room) this.audioBlocked.set(!room.canPlaybackAudio);
    });
    try {
      await room.connect(access.url, access.token, { autoSubscribe: role === 'VIEWER' });
      this.check(version);
    } catch (error) {
      await room.disconnect();
      throw error;
    }
    return room;
  }
  async unlockAudio() {
    try {
      await this.room?.startAudio();
      this.audioBlocked.set(false);
    } catch {
      this.audioBlocked.set(true);
    }
  }
  async stop() {
    ++this.version;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const room = this.room;
    this.room = null;
    const id = this.hostId;
    this.hostId = '';
    this.video()?.detach();
    this.audio()?.detach();
    this.video.set(null);
    this.audio.set(null);
    this.audioBlocked.set(false);
    this.state.set('IDLE');
    // Stop sending immediately even when the API is unavailable. Server lease cleans up later.
    await room?.disconnect();
    if (id) {
      try {
        await firstValueFrom(this.api.end(id));
      } catch {
        this.error.set(
          'Emisión detenida en este equipo. El servidor cerrará la sala al vencer la conexión.',
        );
      }
    }
  }
  private check(version: number) {
    if (version !== this.version) throw new Error('Operación cancelada');
  }
  ngOnDestroy() {
    void this.stop();
  }
}
