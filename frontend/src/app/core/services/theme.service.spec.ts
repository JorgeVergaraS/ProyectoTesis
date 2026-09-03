import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    TestBed.configureTestingModule({});
  });

  it('uses the default theme when there is no saved preference', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.current()).toBe('default');
    expect(document.documentElement.dataset['theme']).toBe('default');
  });

  it('applies and persists the selected theme', () => {
    const service = TestBed.inject(ThemeService);

    service.select('oled');

    expect(service.current()).toBe('oled');
    expect(document.documentElement.dataset['theme']).toBe('oled');
    expect(localStorage.getItem('nexo-theme')).toBe('oled');
  });
});
