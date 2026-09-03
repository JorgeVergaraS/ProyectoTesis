import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../../../core/services/theme.service';
import { SettingsPanelComponent } from './settings-panel.component';

describe('SettingsPanelComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [SettingsPanelComponent] });
  });

  it('offers three themes and applies the selected option', () => {
    const fixture = TestBed.createComponent(SettingsPanelComponent);
    const theme = TestBed.inject(ThemeService);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('.theme-option');
    expect(options).toHaveLength(3);

    options[1].click();
    fixture.detectChanges();

    expect(theme.current()).toBe('oled');
    expect(options[1].getAttribute('aria-checked')).toBe('true');
  });

  it('emits close from the header control', () => {
    const fixture = TestBed.createComponent(SettingsPanelComponent);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.close-settings').click();

    expect(closed).toHaveBeenCalledOnce();
  });

  it('offers and applies the three button styles', () => {
    const fixture = TestBed.createComponent(SettingsPanelComponent);
    const theme = TestBed.inject(ThemeService);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('.button-style-option');
    expect(options).toHaveLength(3);

    options[2].click();
    fixture.detectChanges();

    expect(theme.buttonStyle()).toBe('y2k');
    expect(options[2].getAttribute('aria-checked')).toBe('true');
  });
});
