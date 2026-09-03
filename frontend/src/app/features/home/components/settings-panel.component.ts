import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { NexoTheme, ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../../../shared/components/icon.component';

type ThemeOption = {
  id: NexoTheme;
  name: string;
  description: string;
};

@Component({
  selector: 'nexo-settings-panel',
  imports: [IconComponent],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.css',
})
export class SettingsPanelComponent implements AfterViewInit {
  readonly closed = output<void>();
  readonly theme = inject(ThemeService);
  readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  readonly options: readonly ThemeOption[] = [
    {
      id: 'default',
      name: 'Predeterminado',
      description: 'Azul nocturno con acentos aqua y violeta.',
    },
    {
      id: 'oled',
      name: 'OLED',
      description: 'Negro puro, contraste alto y brillo reducido.',
    },
    {
      id: 'light',
      name: 'Modo claro',
      description: 'Superficies luminosas con texto azul profundo.',
    },
  ];

  ngAfterViewInit(): void {
    queueMicrotask(() => this.closeButton()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }

  select(theme: NexoTheme): void {
    this.theme.select(theme);
  }
}
