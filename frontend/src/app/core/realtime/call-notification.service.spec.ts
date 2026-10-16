import { CallNotificationService } from './call-notification.service';

describe('CallNotificationService', () => {
  let service: CallNotificationService;

  beforeEach(() => {
    localStorage.clear();
    service = new CallNotificationService();
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('remembers whether the user wants a ringtone', () => {
    expect(service.ringtoneEnabled()).toBe(true);
    service.setRingtoneEnabled(false);

    const reloaded = new CallNotificationService();
    expect(reloaded.ringtoneEnabled()).toBe(false);
    reloaded.dispose();
  });

  it('requests system notification permission only after explicit opt-in', async () => {
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = requestPermission;
      onclick: (() => void) | null = null;
      close = vi.fn();
      constructor(
        readonly title: string,
        readonly options?: NotificationOptions,
      ) {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    service = new CallNotificationService();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(await service.enableDesktopNotifications()).toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(service.desktopEnabled()).toBe(true);
  });

  it('shows a generic notification in the background and closes it when the call ends', () => {
    const notifications: FakeNotification[] = [];
    class FakeNotification {
      static permission: NotificationPermission = 'granted';
      onclick: (() => void) | null = null;
      close = vi.fn();
      constructor(
        readonly title: string,
        readonly options?: NotificationOptions,
      ) {
        notifications.push(this);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    localStorage.setItem('nexo.call-alerts.desktop', 'true');
    service = new CallNotificationService();

    service.syncIncomingCall('call-123');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toBe('Llamada entrante en Nexo');
    expect(notifications[0]?.options?.body).not.toContain('call-123');

    service.syncIncomingCall(null);
    expect(notifications[0]?.close).toHaveBeenCalledOnce();
  });
});
