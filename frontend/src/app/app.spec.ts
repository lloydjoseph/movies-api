import { TestBed } from '@angular/core/testing';
import { MovieApiService } from './movie-api.service';
import { App } from './app';

describe('App', () => {
  const api = {
    currentUser: () => Promise.resolve({ email: 'joseph@example.com', name: 'Joseph Lloyd' }),
    listMovies: () => Promise.resolve({
      items: [{ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 }],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
      hasNext: false,
    }),
    createMovie: () => Promise.resolve({ id: 2, name: 'New movie', releaseYear: 2025, rating: null }),
    updateMovie: () => Promise.resolve({ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 }),
    deleteMovie: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: MovieApiService, useValue: api }],
    }).compileComponents();
  });

  it('loads and displays the signed-in user’s collection', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    expect(rendered.querySelector('h1')?.textContent).toContain('Movies');
    expect(rendered.textContent).toContain('Arrival');
  });
});
