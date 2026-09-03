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

export type BroadcastStudioState =
  'IDLE' | 'PREVIEWING' | 'CONNECTING' | 'LIVE' | 'ENDING' | 'ERROR';

@Component({
  selector: 'nexo-broadcast-studio',
  imports: [IconComponent],
  templateUrl: './broadcast-studio.component.html',
  styleUrl: './broadcast-studio.component.css',
})
export class BroadcastStudioComponent implements OnDestroy {
  readonly media = inject(MediaDeviceService);
  readonly calls = inject(VoiceCallService);
  readonly state = signal<BroadcastStudioState>('IDLE');
  readonly selectedSource = signal<StudioSource>(this.media.cameraSupported ? 'camera' : 'screen');
  readonly error = signal('');
  readonly notice = signal('');
  readonly preview = viewChild<ElementRef<HTMLVideoElement>>('preview');
  readonly busy = computed(() => ['CONNECTING', 'ENDING'].includes(this.state()));
  readonly canPrepare = computed(
    () =>
      this.media.cameraSupported &&
      (this.selectedSource() === 'camera' || this.media.screenSupported) &&
      !this.calls.occupied() &&
      !this.busy(),
  );

  constructor() {
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
        this.state.set('IDLE');
        this.notice.set('Dejaste de compartir la pantalla. La vista previa se cerró.');
      } else if (reason === 'device-lost') {
        this.state.set('ERROR');
        this.error.set('Se desconectó un dispositivo. Vuelve a preparar la vista previa.');
      }
    });
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
    const value = (event.target as HTMLSelectElement).value;
    await this.changeDevice(() => this.media.changeMicrophone(value));
  }

  async changeCamera(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    await this.changeDevice(() => this.media.changeCamera(value));
  }

  finishPreview(): void {
    if (!this.media.stream() && !this.busy()) return;
    this.state.set('ENDING');
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
      !window.confirm('La vista previa está activa. ¿Quieres cerrarla y liberar los dispositivos?')
    )
      return false;
    this.finishPreview();
    return true;
  }

  ngOnDestroy(): void {
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
