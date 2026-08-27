import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { StatusComponent } from './status.component';

describe('StatusComponent', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('shows loading and then a successful API connection', () => {
    const fixture = TestBed.createComponent(StatusComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    const request = http.expectOne('/api/public/health');
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'UP', service: 'nexo-backend' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conectada');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
  });

  it('shows a connection error and allows retrying', () => {
    const fixture = TestBed.createComponent(StatusComponent);
    fixture.detectChanges();
    http.expectOne('/api/public/health').flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin conexión');
    fixture.nativeElement.querySelector('button').click();
    http.expectOne('/api/public/health').flush({ status: 'UP', service: 'nexo-backend' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conectada');
  });

  it('does not report another service as Nexo', () => {
    const fixture = TestBed.createComponent(StatusComponent);
    fixture.detectChanges();
    http.expectOne('/api/public/health').flush({ status: 'UP', service: 'other-service' });
    expect(fixture.componentInstance.state()).toBe('error');
  });
});
