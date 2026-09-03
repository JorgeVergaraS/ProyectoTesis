import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  exhaustMap,
  firstValueFrom,
  forkJoin,
  merge,
  Subject,
  switchMap,
  timer,
} from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ChatService } from '../../../../core/services/chat.service';
import { Conversation, DemoUser, Message, Workspace } from '../../../../core/models/demo';
import { AvatarComponent } from '../../../../shared/components/avatar.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { MessageTextComponent } from '../../../../shared/components/message-text.component';
import { VoiceCallService } from '../../../../core/realtime/voice-call.service';
import {
  WorkspaceNavigationComponent,
  WorkspaceView,
} from '../../components/workspace-navigation.component';
import {
  ConversationInboxComponent,
  InboxFilter,
} from '../../components/conversation-inbox.component';
import { ProfilePanelComponent } from '../../components/profile-panel.component';

@Component({
  selector: 'app-home',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    AvatarComponent,
    IconComponent,
    MessageTextComponent,
    WorkspaceNavigationComponent,
    ConversationInboxComponent,
    ProfilePanelComponent,
    RouterLink,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  readonly calls = inject(VoiceCallService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly workspace = signal<Workspace>({ channels: [], directs: [], people: [] });
  readonly providerLabel = computed(() => {
    switch (this.auth.session.kind()) {
      case 'demo':
        return 'el modo demostración local';
      case 'local':
        return 'una cuenta local Nexo';
      default:
        return 'Microsoft Entra ID';
    }
  });
  readonly dashboardView = signal<'home' | 'explore' | 'communities' | 'messages' | 'calls'>(
    'home',
  );
  readonly activeId = signal(this.route.snapshot.queryParamMap.get('conversation') ?? '');
  readonly active = computed(() =>
    [...this.workspace().channels, ...this.workspace().directs].find(
      (c) => c.id === this.activeId(),
    ),
  );
  readonly view = signal<WorkspaceView>('chat');
  readonly inboxOpen = signal(window.innerWidth <= 760);
  readonly inboxFilter = signal<InboxFilter>('all');
  readonly peer = computed(() =>
    this.workspace().people.find((person) => person.id === this.active()?.peerId),
  );
  readonly detailsOpen = signal(window.innerWidth >= 1200);
  readonly initialLoading = signal(true);
  readonly messagesLoading = signal(false);
  readonly connected = signal(false);
  readonly connectionError = signal('');
  readonly actionError = signal('');
  readonly actionBusy = signal(false);
  readonly profileOpen = signal(false);
  readonly sending = signal(false);
  readonly messages = signal<Message[]>([]);
  readonly members = signal<DemoUser[]>([]);
  readonly filter = new FormControl('', { nonNullable: true });
  readonly filterValue = toSignal(this.filter.valueChanges, { initialValue: '' });
  readonly draft = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  readonly draftText = toSignal(this.draft.valueChanges, { initialValue: '' });
  readonly composer = new FormGroup({ body: this.draft });
  readonly channels = computed(() =>
    this.workspace().channels.filter((c) => this.matches(c.title)),
  );
  readonly people = computed(() =>
    this.workspace().people.filter(
      (p) => p.id !== this.auth.session.user()?.id && this.matches(p.displayName),
    ),
  );
  readonly joinedCount = computed(() => this.workspace().channels.filter((c) => c.joined).length);
  readonly inboxChannels = computed(() => this.channels().filter((c) => c.joined));
  readonly onlineCount = computed(() => this.workspace().people.filter((p) => p.online).length);
  readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');
  readonly profilePanel = viewChild(ProfilePanelComponent);
  private readonly refreshWorkspace = new Subject<void>();
  private readonly refreshMessages = new Subject<void>();
  private readonly drafts = new Map<string, string>();
  private pendingSend: { conversation: string; body: string; clientId: string } | null = null;
  private readonly selected = computed(() => {
    const c = this.active();
    return c?.joined ? c.id : '';
  });

  constructor() {
    merge(timer(0, 5000), this.refreshWorkspace)
      .pipe(
        exhaustMap(() =>
          this.chat.workspace().pipe(
            catchError(() => {
              this.connectionError.set('Conexión interrumpida. Reintentando automáticamente…');
              this.connected.set(false);
              this.initialLoading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((workspace) => {
        this.workspace.set(workspace);
        const current = this.auth.session.user();
        const refreshed = workspace.people.find((person) => person.id === current?.id);
        if (
          refreshed &&
          current &&
          (refreshed.avatarUrl !== current.avatarUrl ||
            refreshed.displayName !== current.displayName ||
            refreshed.username !== current.username ||
            refreshed.bio !== current.bio ||
            refreshed.color !== current.color ||
            refreshed.availability !== current.availability)
        )
          this.auth.session.user.set({ ...refreshed, email: current.email });
        this.initialLoading.set(false);
        this.connectionError.set('');
        this.connected.set(true);
        if (!this.active() && workspace.channels.length)
          this.activeId.set(
            workspace.channels.find((c) => c.slug === 'general')?.id ?? workspace.channels[0].id,
          );
      });
    toObservable(this.selected)
      .pipe(
        switchMap((id) => {
          this.messages.set([]);
          this.members.set([]);
          this.messagesLoading.set(!!id);
          if (!id) return EMPTY;
          return merge(timer(0, 2000), this.refreshMessages).pipe(
            exhaustMap(() =>
              forkJoin({
                messages: this.chat.messages(id),
                members: this.chat.members(id),
              }).pipe(
                catchError(() => {
                  this.messagesLoading.set(false);
                  this.connected.set(false);
                  this.connectionError.set('No se pudo actualizar la conversación. Reintentando…');
                  this.refreshWorkspace.next();
                  return EMPTY;
                }),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        const element = this.messageList()?.nativeElement;
        const nearBottom =
          !element || element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        const first = this.messagesLoading();
        const changed = this.messages().at(-1)?.id !== result.messages.at(-1)?.id;
        this.messages.set(result.messages);
        this.members.set(result.members);
        this.messagesLoading.set(false);
        this.connected.set(true);
        this.connectionError.set('');
        if (first || (changed && nearBottom)) requestAnimationFrame(() => this.scrollBottom());
      });
  }

  private matches(value: string): boolean {
    return value.toLowerCase().includes(this.filterValue().trim().toLowerCase());
  }
  select(conversation: Conversation): void {
    this.drafts.set(this.activeId(), this.draft.value);
    this.activeId.set(conversation.id);
    this.draft.setValue(this.drafts.get(conversation.id) ?? '');
    this.view.set('chat');
    this.inboxOpen.set(false);
    if (window.innerWidth < 1200) this.detailsOpen.set(false);
    this.actionError.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { conversation: conversation.id },
      replaceUrl: true,
    });
  }
  navigate(view: WorkspaceView): void {
    this.view.set(view);
    if (view === 'chat') this.inboxOpen.set(true);
    this.filter.setValue('');
    this.actionError.set('');
  }
  openOwnProfile(): void {
    if (window.matchMedia('(max-width: 760px)').matches) {
      void this.router.navigate(['/profile']);
      return;
    }
    this.profileOpen.set(true);
  }
  requestProfileClose(): void {
    this.profilePanel()?.requestClose();
  }
  profileUpdated(user: DemoUser): void {
    this.auth.session.user.set(user);
    this.workspace.update((workspace) => ({
      ...workspace,
      people: workspace.people.map((person) =>
        person.id === user.id ? { ...person, ...user } : person,
      ),
    }));
    this.members.update((members) =>
      members.map((person) => (person.id === user.id ? { ...person, ...user } : person)),
    );
    this.messages.update((messages) =>
      messages.map((message) =>
        message.senderId === user.id
          ? {
              ...message,
              senderName: user.displayName,
              senderColor: user.color,
              senderAvatarUrl: user.avatarUrl,
            }
          : message,
      ),
    );
    this.refreshWorkspace.next();
    this.refreshMessages.next();
  }
  async membership(conversation: Conversation, join: boolean): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      await firstValueFrom(
        join ? this.chat.join(conversation.id) : this.chat.leave(conversation.id),
      );
      this.workspace.set(await firstValueFrom(this.chat.workspace()));
      if (join) {
        const updated = this.workspace().channels.find((c) => c.id === conversation.id);
        if (updated) this.select(updated);
      } else {
        this.messages.set([]);
        this.members.set([]);
      }
    } catch {
      this.actionError.set('No pudimos cambiar tu membresía. Vuelve a intentarlo.');
    } finally {
      this.actionBusy.set(false);
    }
  }
  async direct(person: DemoUser): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      const conversation = await firstValueFrom(this.chat.direct(person.id));
      this.workspace.set(await firstValueFrom(this.chat.workspace()));
      this.select(conversation);
    } catch {
      this.actionError.set('No pudimos abrir la conversación. Inténtalo de nuevo.');
    } finally {
      this.actionBusy.set(false);
    }
  }
  async send(): Promise<void> {
    const conversation = this.active();
    const body = this.draft.value.trim();
    if (!conversation?.joined || !body || this.draft.invalid || this.sending()) return;
    this.sending.set(true);
    this.actionError.set('');
    if (
      !this.pendingSend ||
      this.pendingSend.conversation !== conversation.id ||
      this.pendingSend.body !== body
    ) {
      this.pendingSend = { conversation: conversation.id, body, clientId: crypto.randomUUID() };
    }
    const pending = this.pendingSend;
    try {
      await firstValueFrom(this.chat.send(pending.conversation, pending.body, pending.clientId));
      this.drafts.delete(conversation.id);
      if (this.activeId() === conversation.id && this.draft.value.trim() === body)
        this.draft.setValue('');
      this.pendingSend = null;
      this.refreshMessages.next();
      requestAnimationFrame(() => this.scrollBottom());
    } catch {
      this.actionError.set(
        'No se confirmó el envío. Tu texto está guardado en esta pestaña; vuelve a enviar para reintentar sin duplicarlo.',
      );
    } finally {
      this.sending.set(false);
    }
  }
  onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }
  async logout(): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    if (this.calls.occupied()) await this.calls.hangUp();
    const revoked = await this.auth.logout();
    await this.router.navigate(['/login'], {
      queryParams: revoked ? {} : { reason: 'local-only' },
    });
  }
  retry(): void {
    this.refreshWorkspace.next();
    this.refreshMessages.next();
  }
  openDashboard(
    view: 'home' | 'explore' | 'communities' | 'messages' | 'calls',
    event?: Event,
  ): void {
    event?.preventDefault();
    this.dashboardView.set(view);
    const target =
      view === 'home'
        ? 'dashboard-top'
        : view === 'messages' || view === 'calls'
          ? 'activity'
          : 'communities';
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  newDay(index: number): boolean {
    return (
      index === 0 ||
      new Date(this.messages()[index].sentAt).toDateString() !==
        new Date(this.messages()[index - 1].sentAt).toDateString()
    );
  }
  private scrollBottom(): void {
    const element = this.messageList()?.nativeElement;
    if (element) element.scrollTop = element.scrollHeight;
  }
}
