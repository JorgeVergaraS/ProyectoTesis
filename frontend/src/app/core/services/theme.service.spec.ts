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
    expect(service.buttonStyle()).toBe('matte');
    expect(document.documentElement.dataset['theme']).toBe('default');
    expect(document.documentElement.dataset['buttonStyle']).toBe('matte');
  });

  it('applies and persists the selected theme', () => {
    const service = TestBed.inject(ThemeService);

    service.select('oled');

    expect(service.current()).toBe('oled');
    expect(document.documentElement.dataset['theme']).toBe('oled');
    expect(localStorage.getItem('nexo-theme')).toBe('oled');
  });

  it('applies and persists the selected button style', () => {
    const service = TestBed.inject(ThemeService);

    service.selectButtonStyle('sky-glass');

    expect(service.buttonStyle()).toBe('sky-glass');
    expect(document.documentElement.dataset['buttonStyle']).toBe('sky-glass');
    expect(localStorage.getItem('nexo-button-style')).toBe('sky-glass');
  });
});
