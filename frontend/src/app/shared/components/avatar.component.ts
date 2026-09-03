import { Component, computed, input, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'nexo-avatar',
  template: `<span
    class="avatar"
    [style.--avatar-color]="color()"
    [class.large]="large()"
    aria-hidden="true"
  >
    @if (imageUrl() && failedUrl() !== imageUrl()) {
      <img [src]="imageUrl()" alt="" (error)="failedUrl.set(imageUrl())" />
    } @else {
      {{ name().slice(0, 1) }}
    }
    @if (online()) {
      <i></i>
    }
  </span>`,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
      .avatar {
        position: relative;
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        color: var(--avatar-color);
        background: color-mix(in srgb, var(--avatar-color) 16%, #101525);
        border: 1px solid color-mix(in srgb, var(--avatar-color) 25%, transparent);
        font-size: 15px;
        font-weight: 650;
      }
      .large {
        width: 56px;
        height: 56px;
        font-size: 23px;
        border-radius: 50%;
      }
      img {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        object-fit: cover;
      }
      i {
        position: absolute;
        bottom: -2px;
        right: -2px;
        background: #4ade80;
        width: 10px;
        height: 10px;
        border: 2px solid #101525;
        border-radius: 50%;
      }
    `,
  ],
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly color = input('#8b5cf6');
  readonly online = input(false);
  readonly large = input(false);
  readonly src = input<string | null | undefined>(null);
  readonly failedUrl = signal('');
  readonly imageUrl = computed(() => {
    const path = this.src();
    return path && /^\/api\/(?:demo\/)?avatars\/[0-9a-f-]+\/[0-9a-f-]+$/i.test(path)
      ? environment.apiUrl + path.slice(4)
      : '';
  });
}
