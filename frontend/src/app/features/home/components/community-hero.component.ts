import { Component, output } from '@angular/core';
import { IconComponent } from '../../../shared/components/icon.component';
@Component({
  selector: 'nexo-community-hero',
  imports: [IconComponent],
  template: `
    <div class="community-hero">
      <div class="community-orbit" aria-hidden="true"><span>N</span></div>
      <div class="hero-copy">
        <span class="eyebrow">ENCUENTRA TU LUGAR</span>
        <h1>Una comunidad.<br /><span>Muchas conversaciones.</span></h1>
        <p class="page-intro">
          Desde tu próximo proyecto hasta los planes después de clases.<br />Hay un espacio para lo
          que te mueve.
        </p>
        <button class="secondary-button" (click)="people.emit()">
          Conoce a tu comunidad <nexo-icon name="arrow" />
        </button>
      </div>
    </div>
  `,
  styleUrl: './community-hero.component.css',
})
export class CommunityHeroComponent {
  readonly people = output<void>();
}
