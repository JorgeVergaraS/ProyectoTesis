import { Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Conversation, DemoUser } from '../../../core/models/demo';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';
export type InboxFilter = 'all' | 'people' | 'groups';
@Component({
  selector: 'nexo-conversation-inbox',
  imports: [ReactiveFormsModule, AvatarComponent, IconComponent],
  templateUrl: './conversation-inbox.component.html',
  styleUrl: './conversation-inbox.component.css',
})
export class ConversationInboxComponent {
  readonly people = input.required<DemoUser[]>();
  readonly channels = input.required<Conversation[]>();
  readonly directs = input.required<Conversation[]>();
  readonly active = input<Conversation>();
  readonly activeId = input('');
  readonly busy = input(false);
  readonly connected = input(false);
  readonly searchControl = input.required<FormControl<string>>();
  readonly filterKind = input.required<InboxFilter>();
  readonly filterChange = output<InboxFilter>();
  readonly personSelected = output<DemoUser>();
  readonly channelSelected = output<Conversation>();
  readonly navigate = output<'people' | 'discover'>();
  hasDirect(person: DemoUser): boolean {
    return this.directs().some((conversation) => conversation.peerId === person.id);
  }
}
