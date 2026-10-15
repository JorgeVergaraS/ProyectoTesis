import { Injectable, signal } from '@angular/core';

const SOUND_KEY = 'nexo.call-alerts.sound';
const DESKTOP_KEY = 'nexo.call-alerts.desktop';

@Injectable({ providedIn: 'root' })
export class CallNotificationService {
  readonly ringtoneEnabled = signal(this.readPreference(SOUND_KEY, true));
  readonly desktopEnabled = signal(this.readPreference(DESKTOP_KEY, false));
  readonly permission = signal(this.readPermission());
  readonly soundNeedsGesture = signal(false);

  private context: AudioContext | null = null;
  private ringTimer: ReturnType<typeof setInterval> | null = null;
  private currentCallId: string | null = null;
  private notification: Notification | null = null;

  setRingtoneEnabled(enabled: boolean): void {
    this.ringtoneEnabled.set(enabled);
    this.writePreference(SOUND_KEY, enabled);
    if (!enabled) this.stopRingtone();
    else if (this.currentCallId) void this.startRingtone();
  }

  async enableDesktopNotifications(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
      this.permission.set('unsupported');
      return false;
    }
    try {
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
      this.permission.set(permission);
      const enabled = permission === 'granted';
      this.desktopEnabled.set(enabled);
      this.writePreference(DESKTOP_KEY, enabled);
      if (enabled && this.currentCallId) this.showDesktopNotification();
      return enabled;
    } catch {
      this.desktopEnabled.set(false);
      return false;
    }
  }

  async disableDesktopNotifications(): Promise<void> {
    this.desktopEnabled.set(false);
    this.writePreference(DESKTOP_KEY, false);
    this.closeDesktopNotification();
  }

  /** Call when a new incoming call arrives or the current incoming call changes. */
  syncIncomingCall(callId: string | null): void {
    if (callId === this.currentCallId) return;
    this.stopRingtone();
    this.closeDesktopNotification();
    this.currentCallId = callId;
    this.soundNeedsGesture.set(false);
    if (!callId) return;
    if (this.ringtoneEnabled()) void this.startRingtone();
    this.showDesktopNotification();
  }

  /** A user gesture can unlock Web Audio on mobile and browsers with autoplay limits. */
  async testRingtone(): Promise<boolean> {
    try {
      const context = this.audioContext();
      await context.resume();
      this.soundNeedsGesture.set(false);
      this.playChime(context);
      if (this.currentCallId && this.ringtoneEnabled()) this.scheduleRingtone(context);
      return true;
    } catch {
      this.soundNeedsGesture.set(true);
      return false;
    }
  }

  dispose(): void {
    this.syncIncomingCall(null);
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
  }

  private async startRingtone(): Promise<void> {
    if (!this.ringtoneEnabled() || !this.currentCallId || this.ringTimer) return;
    try {
      const context = this.audioContext();
      await context.resume();
      if (!this.currentCallId || !this.ringtoneEnabled()) return;
      this.soundNeedsGesture.set(false);
      this.playChime(context);
      this.scheduleRingtone(context);
    } catch {
      this.soundNeedsGesture.set(true);
    }
  }

  private audioContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      const Context = window.AudioContext;
      if (!Context) throw new Error('Web Audio is unavailable');
      this.context = new Context();
    }
    return this.context;
  }

  private playChime(context: AudioContext): void {
    const startAt = context.currentTime;
    for (const [offset, frequency] of [0, 0.22].map((offset, index) => [
      offset,
      index ? 740 : 587,
    ])) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, startAt + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.3);
    }
  }

  private scheduleRingtone(context: AudioContext): void {
    if (this.ringTimer) return;
    this.ringTimer = setInterval(() => {
      if (context.state === 'running') this.playChime(context);
    }, 2400);
  }

  private showDesktopNotification(): void {
    if (
      !this.currentCallId ||
      !this.desktopEnabled() ||
      this.permission() !== 'granted' ||
      typeof Notification === 'undefined' ||
      !document.hidden
    )
      return;
    try {
      const notification = new Notification('Llamada entrante en Nexo', {
        body: 'Abre Nexo para responder.',
        tag: 'nexo-incoming-call',
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      this.notification = notification;
    } catch {
      // Browser or operating-system notification settings can block display.
    }
  }

  private closeDesktopNotification(): void {
    this.notification?.close();
    this.notification = null;
  }

  private stopRingtone(): void {
    if (this.ringTimer) clearInterval(this.ringTimer);
    this.ringTimer = null;
  }

  private readPermission(): NotificationPermission | 'unsupported' {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  private readPreference(key: string, fallback: boolean): boolean {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === 'true';
    } catch {
      return fallback;
    }
  }

  private writePreference(key: string, value: boolean): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Preferences remain available for the lifetime of the current page.
    }
  }
}
