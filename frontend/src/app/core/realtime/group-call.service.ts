import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { RemoteTrack, Room } from 'livekit-client';
import { environment } from '../../../environments/environment';
import { DemoSessionStore } from '../auth/demo-session.store';

interface GroupCallAccess {
  url: string;
  token: string;
  roomName: string;
}

@Injectable({ providedIn: 'root' })
export class GroupCallService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly session = inject(DemoSessionStore);
  readonly state = signal<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'>('IDLE');
  readonly conversationId = signal('');
  readonly title = signal('');
  readonly participants = signal(0);
  readonly muted = signal(false);
  readonly audioBlocked = signal(false);
  readonly error = signal('');
  private room: Room | null = null;
  private version = 0;
  private readonly audio = new Map<RemoteTrack, HTMLAudioElement>();

  occupied(): boolean {
    return this.state() !== 'IDLE';
  }

  async join(conversationId: string, title: string): Promise<void> {
    if (this.occupied()) return;
    const version = ++this.version;
    this.state.set('CONNECTING');
    this.conversationId.set(conversationId);
    this.title.set(title);
    this.error.set('');
    try {
      const prefix = this.session.kind() === 'demo' ? '/demo' : '';
      const access = await firstValueFrom(
        this.http.post<GroupCallAccess>(
          `${environment.apiUrl}${prefix}/conversations/${conversationId}/group-call/access`,
          {},
        ),
      );
      if (version !== this.version) return;
      const { Room, RoomEvent } = await import('livekit-client');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;
      const updateCount = () => {
        if (this.room === room) this.participants.set(room.remoteParticipants.size + 1);
      };
      room.on(RoomEvent.ParticipantConnected, updateCount);
      room.on(RoomEvent.ParticipantDisconnected, updateCount);
      room.on(RoomEvent.Reconnecting, () => this.state.set('RECONNECTING'));
      room.on(RoomEvent.Reconnected, () => this.state.set('CONNECTED'));
      room.on(RoomEvent.AudioPlaybackStatusChanged, () =>
        this.audioBlocked.set(!room.canPlaybackAudio),
      );
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== 'audio' || this.audio.has(track)) return;
        const element = document.createElement('audio');
        element.autoplay = true;
        track.attach(element);
        document.body.appendChild(element);
        this.audio.set(track, element);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => this.removeAudio(track));
      room.on(RoomEvent.Disconnected, () => {
        if (this.room === room) void this.leave();
      });
      await room.connect(access.url, access.token, { autoSubscribe: true });
      if (version !== this.version) {
        await room.disconnect();
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      updateCount();
      this.state.set('CONNECTED');
    } catch {
      if (version !== this.version) return;
      await this.leave();
      this.error.set('No se pudo entrar a la llamada grupal. Revisa el micrófono y la conexión.');
      this.state.set('ERROR');
    }
  }

  async toggleMute(): Promise<void> {
    if (!this.room) return;
    const next = !this.muted();
    await this.room.localParticipant.setMicrophoneEnabled(!next);
    this.muted.set(next);
  }

  async unlockAudio(): Promise<void> {
    try {
      await this.room?.startAudio();
      this.audioBlocked.set(false);
    } catch {
      this.audioBlocked.set(true);
    }
  }

  async leave(): Promise<void> {
    ++this.version;
    const room = this.room;
    this.room = null;
    this.audio.forEach((element, track) => {
      track.detach(element);
      element.remove();
    });
    this.audio.clear();
    this.conversationId.set('');
    this.title.set('');
    this.participants.set(0);
    this.muted.set(false);
    this.audioBlocked.set(false);
    this.state.set('IDLE');
    await room?.disconnect();
  }

  clearError(): void {
    this.error.set('');
    if (this.state() === 'ERROR') this.state.set('IDLE');
  }

  private removeAudio(track: RemoteTrack): void {
    const element = this.audio.get(track);
    if (!element) return;
    track.detach(element);
    element.remove();
    this.audio.delete(track);
  }

  ngOnDestroy(): void {
    void this.leave();
  }
}
