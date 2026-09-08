import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type StudioSource = 'camera' | 'screen';
export type BroadcastFrameRate = 15 | 30 | 60;
export type MediaStopReason = 'user' | 'navigation' | 'source-ended' | 'device-lost';

export interface MediaInputDevice {
  deviceId: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class MediaDeviceService {
  readonly stream = signal<MediaStream | null>(null);
  readonly source = signal<StudioSource | null>(null);
  readonly audioInputs = signal<MediaInputDevice[]>([]);
  readonly videoInputs = signal<MediaInputDevice[]>([]);
  readonly selectedAudioId = signal('');
  readonly selectedVideoId = signal('');
  readonly frameRate = signal<BroadcastFrameRate>(30);
  readonly microphoneMuted = signal(false);
  readonly audioLevel = signal(0);
  readonly stopReason = signal<MediaStopReason | null>(null);
  readonly cameraSupported: boolean;
  readonly screenSupported: boolean;

  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaDevices =
    typeof navigator === 'undefined' ? null : (navigator.mediaDevices ?? null);
  private requestVersion = 0;
  private meterFrame: number | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  constructor() {
    this.cameraSupported = typeof this.mediaDevices?.getUserMedia === 'function';
    this.screenSupported = typeof this.mediaDevices?.getDisplayMedia === 'function';
    this.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange);
    this.destroyRef.onDestroy(() => {
      this.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
      this.stop('navigation');
    });
  }

  async start(
    source: StudioSource,
    audioDeviceId = '',
    videoDeviceId = '',
    frameRate: BroadcastFrameRate = 30,
  ): Promise<MediaStream> {
    if (source === 'camera' && !this.cameraSupported) throw new Error('camera-unsupported');
    if (source === 'screen' && !this.screenSupported) throw new Error('screen-unsupported');

    const version = ++this.requestVersion;
    this.releaseActiveTracks();
    this.stream.set(null);
    this.source.set(null);
    this.selectedAudioId.set('');
    this.selectedVideoId.set('');
    this.frameRate.set(frameRate);
    this.stopReason.set(null);
    this.microphoneMuted.set(false);
    const acquired: MediaStream[] = [];

    try {
      let stream: MediaStream;
      if (source === 'camera') {
        stream = await this.mediaDevices!.getUserMedia({
          audio: this.deviceConstraint(audioDeviceId),
          video: this.videoConstraint(videoDeviceId, frameRate),
        });
        acquired.push(stream);
      } else {
        const display = await this.mediaDevices!.getDisplayMedia({
          video: this.videoConstraint('', frameRate),
          audio: false,
        });
        acquired.push(display);
        if (!display.getVideoTracks().length) throw new Error('screen-unavailable');
        display.getAudioTracks().forEach((track) => track.stop());
        const microphone = await this.mediaDevices!.getUserMedia({
          audio: this.deviceConstraint(audioDeviceId),
          video: false,
        });
        acquired.push(microphone);
        stream = new MediaStream([...display.getVideoTracks(), ...microphone.getAudioTracks()]);
      }

      if (version !== this.requestVersion) {
        throw new Error('request-cancelled');
      }

      this.activate(stream, source, audioDeviceId, videoDeviceId);
      await this.refreshDevices();
      return stream;
    } catch (error: unknown) {
      this.stopStreams(acquired);
      if (version === this.requestVersion) {
        this.stream.set(null);
        this.source.set(null);
        this.resetMeter();
      }
      throw error;
    }
  }

  async changeMicrophone(deviceId: string): Promise<void> {
    const current = this.stream();
    if (!current || !this.cameraSupported) return;
    const wasMuted = this.microphoneMuted();
    const version = ++this.requestVersion;
    const replacement = await this.mediaDevices!.getUserMedia({
      audio: this.deviceConstraint(deviceId),
      video: false,
    });
    if (version !== this.requestVersion || this.stream() !== current) {
      this.stopStreams([replacement]);
      return;
    }

    const oldAudio = current.getAudioTracks();
    oldAudio.forEach((track) => (track.onended = null));
    const next = new MediaStream([...current.getVideoTracks(), ...replacement.getAudioTracks()]);
    oldAudio.forEach((track) => track.stop());
    this.activate(next, this.source()!, deviceId, this.selectedVideoId());
    if (wasMuted) this.applyMicrophoneMute(true);
    await this.refreshDevices();
  }

  async changeCamera(deviceId: string): Promise<void> {
    const current = this.stream();
    if (!current || this.source() !== 'camera' || !this.cameraSupported) return;
    const wasMuted = this.microphoneMuted();
    const version = ++this.requestVersion;
    const replacement = await this.mediaDevices!.getUserMedia({
      audio: false,
      video: this.videoConstraint(deviceId, this.frameRate()),
    });
    if (version !== this.requestVersion || this.stream() !== current) {
      this.stopStreams([replacement]);
      return;
    }

    const oldVideo = current.getVideoTracks();
    oldVideo.forEach((track) => (track.onended = null));
    const next = new MediaStream([...replacement.getVideoTracks(), ...current.getAudioTracks()]);
    oldVideo.forEach((track) => track.stop());
    this.activate(next, 'camera', this.selectedAudioId(), deviceId);
    if (wasMuted) this.applyMicrophoneMute(true);
    await this.refreshDevices();
  }

  toggleMicrophone(): void {
    const tracks = this.stream()?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const muted = !this.microphoneMuted();
    this.applyMicrophoneMute(muted);
  }

  stop(reason: MediaStopReason = 'user'): void {
    this.requestVersion++;
    this.releaseActiveTracks();
    this.stream.set(null);
    this.source.set(null);
    this.selectedAudioId.set('');
    this.selectedVideoId.set('');
    this.microphoneMuted.set(false);
    this.stopReason.set(reason);
  }

  async refreshDevices(): Promise<void> {
    if (typeof this.mediaDevices?.enumerateDevices !== 'function') return;
    try {
      const devices = await this.mediaDevices.enumerateDevices();
      this.audioInputs.set(this.toOptions(devices, 'audioinput', 'Micrófono'));
      this.videoInputs.set(this.toOptions(devices, 'videoinput', 'Cámara'));
    } catch {
      this.audioInputs.set([]);
      this.videoInputs.set([]);
    }
  }

  private activate(
    stream: MediaStream,
    source: StudioSource,
    requestedAudioId: string,
    requestedVideoId: string,
  ): void {
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (!this.stream()?.getTracks().includes(track)) return;
        this.stop(source === 'screen' && track.kind === 'video' ? 'source-ended' : 'device-lost');
      };
    });
    this.stream.set(stream);
    this.source.set(source);
    this.stopReason.set(null);
    this.microphoneMuted.set(false);
    this.selectedAudioId.set(
      stream.getAudioTracks()[0]?.getSettings?.().deviceId ?? requestedAudioId,
    );
    this.selectedVideoId.set(
      source === 'camera'
        ? (stream.getVideoTracks()[0]?.getSettings?.().deviceId ?? requestedVideoId)
        : '',
    );
    this.startMeter(stream);
  }

  private readonly onDeviceChange = (): void => {
    void this.handleDeviceChange();
  };

  private async handleDeviceChange(): Promise<void> {
    await this.refreshDevices();
    if (!this.stream()) return;
    const audioId = this.selectedAudioId();
    const videoId = this.selectedVideoId();
    const missingAudio = audioId && !this.audioInputs().some((item) => item.deviceId === audioId);
    const missingCamera =
      this.source() === 'camera' &&
      videoId &&
      !this.videoInputs().some((item) => item.deviceId === videoId);
    if (missingAudio || missingCamera) this.stop('device-lost');
  }

  private startMeter(stream: MediaStream): void {
    this.resetMeter();
    const AudioContextConstructor =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!AudioContextConstructor || !stream.getAudioTracks().length) return;

    try {
      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      const samples = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      this.audioContext = context;
      this.audioSource = context.createMediaStreamSource(stream);
      this.audioSource.connect(analyser);
      void context.resume().catch(() => undefined);

      const measure = () => {
        if (this.audioContext !== context) return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          energy += normalized * normalized;
        }
        const level = Math.sqrt(energy / samples.length);
        this.audioLevel.set(this.microphoneMuted() ? 0 : Math.min(100, Math.round(level * 260)));
        this.meterFrame = window.requestAnimationFrame(measure);
      };
      measure();
    } catch {
      this.resetMeter();
    }
  }

  private resetMeter(): void {
    if (this.meterFrame !== null && typeof window !== 'undefined')
      window.cancelAnimationFrame(this.meterFrame);
    this.meterFrame = null;
    this.audioLevel.set(0);
    this.audioSource?.disconnect();
    this.audioSource = null;
    const context = this.audioContext;
    this.audioContext = null;
    if (context) void context.close().catch(() => undefined);
  }

  private releaseActiveTracks(): void {
    const current = this.stream();
    current?.getTracks().forEach((track) => (track.onended = null));
    this.stopStreams(current ? [current] : []);
    this.resetMeter();
  }

  private stopStreams(streams: MediaStream[]): void {
    const tracks = new Set(streams.flatMap((stream) => stream.getTracks()));
    tracks.forEach((track) => track.stop());
  }

  private deviceConstraint(deviceId: string): true | MediaTrackConstraints {
    return deviceId ? { deviceId: { exact: deviceId } } : true;
  }

  private videoConstraint(deviceId: string, frameRate: BroadcastFrameRate): MediaTrackConstraints {
    return {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      frameRate: { ideal: frameRate, max: frameRate },
    };
  }

  private applyMicrophoneMute(muted: boolean): void {
    this.stream()
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = !muted));
    this.microphoneMuted.set(muted);
    if (muted) this.audioLevel.set(0);
  }

  private toOptions(
    devices: MediaDeviceInfo[],
    kind: MediaDeviceKind,
    fallback: string,
  ): MediaInputDevice[] {
    return devices
      .filter((device) => device.kind === kind)
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `${fallback} ${index + 1}`,
      }));
  }
}
