import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MediaDeviceService, StudioSource } from '../../../core/media/media-device.service';
import { VoiceCallService } from '../../../core/realtime/voice-call.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BroadcastApiService } from '../../../core/media/broadcast-api.service';
import { BroadcastMediaService } from '../../../core/media/broadcast-media.service';
import { ChatService } from '../../../core/services/chat.service';
import { Conversation } from '../../../core/models/demo';

export type BroadcastStudioState =
  'IDLE' | 'PREVIEWING' | 'CONNECTING' | 'LIVE' | 'ENDING' | 'ERROR';

@Component({
  selector: 'nexo-broadcast-studio',
  imports: [IconComponent, FormsModule],
  providers: [BroadcastMediaService],
  templateUrl: './broadcast-studio.component.html',
  styleUrl: './broadcast-studio.component.css',
})
export class BroadcastStudioComponent implements OnDestroy {
  readonly media = inject(MediaDeviceService);
  readonly calls = inject(VoiceCallService);
  readonly broadcast = inject(BroadcastMediaService);
  private readonly api = inject(BroadcastApiService);
  private readonly chat = inject(ChatService);
  readonly destinations = signal<Conversation[]>([]);
  readonly enabled = signal(false);
  readonly emitting = computed(() =>
    ['CONNECTING', 'LIVE', 'RECONNECTING'].includes(this.broadcast.state()),
  );
  destination = '';
  title = '';
  private destroyed = false;
  readonly state = signal<BroadcastStudioState>('IDLE');
  readonly selectedSource = signal<StudioSource>(this.media.cameraSupported ? 'camera' : 'screen');
  readonly error = signal('');
  readonly notice = signal('');
  readonly preview = viewChild<ElementRef<HTMLVideoElement>>('preview');
  readonly busy = computed(
    () =>
      ['CONNECTING', 'ENDING'].includes(this.state()) || this.broadcast.state() === 'CONNECTING',
  );
  readonly canPrepare = computed(
    () =>
      this.media.cameraSupported &&
      (this.selectedSource() === 'camera' || this.media.screenSupported) &&
      !this.calls.occupied() &&
      !this.busy(),
  );

  constructor() {
    void this.loadDestinations();
    effect(() => {
      const status = this.broadcast.state();
      if (status === 'ERROR' || status === 'ENDED') {
        this.media.stop('user');
        this.state.set('IDLE');
      }
    });
    effect(() => {
      const element = this.preview()?.nativeElement;
      const stream = this.media.stream();
      if (!element) return;
      element.srcObject = stream;
      if (stream) void element.play().catch(() => undefined);
      else if (!element.paused) element.pause();
    });

    effect(() => {
      const reason = this.media.stopReason();
      if (reason === 'source-ended') {
        void this.broadcast.stop();
        this.state.set('IDLE');
        this.notice.set('Dejaste de compartir la pantalla. La vista previa se cerró.');
      } else if (reason === 'device-lost') {
        void this.broadcast.stop();
        this.state.set('ERROR');
        this.error.set('Se desconectó un dispositivo. Vuelve a preparar la vista previa.');
      }
    });
  }

  private async loadDestinations() {
    try {
      const [config, workspace] = await Promise.all([
        firstValueFrom(this.api.config()),
        firstValueFrom(this.chat.workspace()),
      ]);
      if (this.destroyed) return;
      this.enabled.set(config.enabled);
      const destinations = [...workspace.channels, ...workspace.directs].filter((c) => c.joined);
      this.destinations.set(destinations);
      this.destination = destinations[0]?.id ?? '';
    } catch {
      if (!this.destroyed) this.error.set('No se pudieron cargar los destinos de transmisión.');
    }
  }

  async startBroadcast() {
    const stream = this.media.stream();
    if (
      !stream ||
      this.busy() ||
      this.emitting() ||
      !this.enabled() ||
      !this.destination ||
      !this.title.trim()
    )
      return;
    this.notice.set('');
    await this.broadcast.publish(
      this.destination,
      this.title.trim(),
      this.media.source() === 'screen' ? 'SCREEN' : 'CAMERA',
      stream,
    );
  }

  selectSource(source: StudioSource): void {
    if (this.busy() || this.media.stream()) return;
    this.selectedSource.set(source);
    this.error.set('');
    this.notice.set('');
    if (this.state() === 'ERROR') this.state.set('IDLE');
  }

  async prepare(): Promise<void> {
    if (!this.canPrepare()) {
      if (this.calls.occupied())
        this.error.set('Finaliza la llamada de voz antes de abrir el estudio multimedia.');
      return;
    }
    this.state.set('CONNECTING');
    this.error.set('');
    this.notice.set('');
    try {
      await this.media.start(this.selectedSource());
      this.state.set('PREVIEWING');
      this.notice.set('Vista previa privada. Nada se está transmitiendo ni grabando.');
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'request-cancelled') {
        this.state.set('IDLE');
        return;
      }
      this.state.set('ERROR');
      this.error.set(this.mediaError(error));
    }
  }

  async changeMicrophone(event: Event): Promise<void> {
    if (this.emitting()) return;
    const value = (event.target as HTMLSelectElement).value;
    await this.changeDevice(() => this.media.changeMicrophone(value));
  }

  async changeCamera(event: Event): Promise<void> {
    if (this.emitting()) return;
    const value = (event.target as HTMLSelectElement).value;
    await this.changeDevice(() => this.media.changeCamera(value));
  }

  finishPreview(): void {
    if (!this.media.stream() && !this.busy()) return;
    this.state.set('ENDING');
    void this.broadcast.stop();
    this.media.stop('user');
    this.state.set('IDLE');
    this.error.set('');
    this.notice.set('Vista previa finalizada. Cámara, pantalla y micrófono están libres.');
  }

  hasActiveMedia(): boolean {
    return !!this.media.stream() || this.busy();
  }

  confirmClose(): boolean {
    if (!this.hasActiveMedia()) return true;
    if (
      !window.confirm(
        this.emitting()
          ? 'Estás transmitiendo. ¿Quieres finalizar la transmisión y cerrar?'
          : 'La vista previa está activa. ¿Quieres cerrarla y liberar los dispositivos?',
      )
    )
      return false;
    this.finishPreview();
    return true;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    void this.broadcast.stop();
    if (this.media.stream() || this.busy()) this.media.stop('navigation');
  }

  private async changeDevice(change: () => Promise<void>): Promise<void> {
    this.state.set('CONNECTING');
    this.error.set('');
    try {
      await change();
      this.state.set('PREVIEWING');
    } catch (error: unknown) {
      this.state.set('ERROR');
      this.error.set(this.mediaError(error));
    }
  }

  private mediaError(error: unknown): string {
    if (error instanceof Error && error.message === 'camera-unsupported')
      return 'Este navegador no permite usar cámara o micrófono.';
    if (error instanceof Error && error.message === 'screen-unsupported')
      return 'Compartir pantalla no está disponible en este navegador.';
    if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name))
      return this.selectedSource() === 'screen'
        ? 'No se compartió la pantalla. Puedes intentarlo nuevamente.'
        : 'Permite la cámara y el micrófono para crear la vista previa.';
    if (error instanceof DOMException && error.name === 'NotFoundError')
      return 'No se encontró uno de los dispositivos seleccionados.';
    if (error instanceof DOMException && error.name === 'NotReadableError')
      return 'Otro programa está usando la cámara o el micrófono.';
    return 'No se pudo preparar la vista previa. Revisa los dispositivos y permisos.';
  }
}
