import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceNavigationComponent } from './workspace-navigation.component';

describe('WorkspaceNavigationComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [WorkspaceNavigationComponent],
      providers: [provideRouter([])],
    }),
  );

  it('opens the reusable profile panel from the account avatar', () => {
    const fixture = TestBed.createComponent(WorkspaceNavigationComponent);
    fixture.componentRef.setInput('view', 'chat');
    fixture.componentRef.setInput('sessionKind', 'local');
    fixture.componentRef.setInput('user', {
      id: '1',
      username: 'jean',
      displayName: 'Jean',
      color: '#8B5CF6',
      bio: '',
      availability: 'AVAILABLE',
      online: true,
    });
    const opened = vi.fn();
    fixture.componentInstance.profileOpen.subscribe(opened);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.account-profile').click();

    expect(opened).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Cuenta Nexo');
  });

  it('opens settings from the gear beside the user name', () => {
    const fixture = TestBed.createComponent(WorkspaceNavigationComponent);
    fixture.componentRef.setInput('view', 'chat');
    fixture.componentRef.setInput('user', {
      id: '1',
      username: 'jean',
      displayName: 'Jean',
      color: '#8B5CF6',
      bio: '',
      online: true,
    });
    const opened = vi.fn();
    fixture.componentInstance.settingsOpen.subscribe(opened);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.settings-button').click();

    expect(opened).toHaveBeenCalledOnce();
  });
});
