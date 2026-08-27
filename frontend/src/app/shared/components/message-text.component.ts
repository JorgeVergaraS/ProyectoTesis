import { Component, computed, input } from '@angular/core';

interface TextPart {
  text: string;
  href?: string;
}

function trimProsePunctuation(candidate: string): string {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let result = candidate;
  while (result) {
    const last = result.at(-1)!;
    const opening = pairs[last];
    if (/[.,!?;:…]/u.test(last)) {
      result = result.slice(0, -1);
    } else if (opening && result.split(last).length > result.split(opening).length) {
      result = result.slice(0, -1);
    } else {
      break;
    }
  }
  return result;
}

function linkParts(text: string): TextPart[] {
  // The boundary avoids turning the suffix of another scheme or an email into a link.
  const pattern = /(^|[\s([{<>"'“‘])((?:https?:\/\/|www\.)[^\s<>"'`“”‘’]+)/giu;
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[1].length;
    const label = trimProsePunctuation(match[2]);
    let url: URL;
    try {
      url = new URL(/^www\./i.test(label) ? `https://${label}` : label);
    } catch {
      continue;
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.hostname === 'www.' ||
      url.username ||
      url.password ||
      /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\\]/u.test(label)
    ) {
      continue;
    }
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: label, href: url.href });
    cursor = start + label.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

@Component({
  selector: 'nexo-message-text',
  template: `@for (part of parts(); track $index) {
    @if (part.href) {
      <a
        [href]="part.href"
        target="_blank"
        rel="noopener noreferrer"
        [attr.aria-label]="part.text + ' (abre en otra pestaña)'"
        [textContent]="part.text"
      ></a>
    } @else {
      <span [textContent]="part.text"></span>
    }
  }`,
  styles: `
    :host {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    a {
      color: #b9caff;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    a:hover {
      color: #e0d2ff;
    }
    a:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 3px;
      border-radius: 2px;
    }
  `,
})
export class MessageTextComponent {
  readonly text = input.required<string>();
  readonly parts = computed(() => linkParts(this.text()));
}
