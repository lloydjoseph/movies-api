import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MovieApiService } from '../movie-api.service';
import type { MovieLookupResult } from '../movie-api.service';
import { MovieLookupComponent } from './movie-lookup';

describe('MovieLookupComponent', () => {
  const arrival: MovieLookupResult = {
    tmdbId: 329865,
    title: 'Arrival',
    originalTitle: 'Arrival',
    releaseYear: 2016,
    alreadyInCollection: false,
  };
  const api = {
    lookupMovies: vi.fn<(query: string) => Promise<MovieLookupResult[]>>(),
  };

  beforeEach(async () => {
    api.lookupMovies.mockReset().mockResolvedValue([arrival]);
    await TestBed.configureTestingModule({
      imports: [MovieLookupComponent],
      providers: [{ provide: MovieApiService, useValue: api }],
    }).compileComponents();
  });

  it('debounces title searches and avoids searching again after selecting a result', async () => {
    const fixture = TestBed.createComponent(MovieLookupComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const selected = vi.fn();
    component.movieSelected.subscribe(selected);
    const nativeElement = fixture.nativeElement as HTMLElement;
    vi.useFakeTimers();

    try {
      fixture.componentRef.setInput('searchTerm', 'Arrival 2016');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(349);
      expect(api.lookupMovies).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(api.lookupMovies).toHaveBeenCalledWith('Arrival 2016');
      expect(component.results()).toEqual([arrival]);
      fixture.detectChanges();
      expect(nativeElement.textContent).toContain('Arrival (2016)');

      component.selectMovie(arrival);
      expect(selected).toHaveBeenCalledWith(arrival);
      fixture.componentRef.setInput('searchTerm', 'Arrival');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(350);
      expect(api.lookupMovies).toHaveBeenCalledOnce();
      expect(nativeElement.textContent).not.toContain('No matches found');
      expect(nativeElement.querySelector('[aria-label="TMDb search results"]')).toBeNull();
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('keeps manual entry available when the provider is unavailable', async () => {
    api.lookupMovies.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const fixture = TestBed.createComponent(MovieLookupComponent);
    vi.useFakeTimers();

    try {
      fixture.componentRef.setInput('searchTerm', 'Arrival');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(350);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('TMDb lookup is unavailable. You can still enter the movie details manually.');
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('marks titles already in the collection and prevents selecting them', async () => {
    const inCollection: MovieLookupResult = {
      ...arrival,
      title: 'The Mist',
      releaseYear: 2007,
      alreadyInCollection: true,
    };
    const differentYear: MovieLookupResult = {
      ...inCollection,
      tmdbId: 2,
      releaseYear: 2016,
      alreadyInCollection: false,
    };
    const missingYear: MovieLookupResult = {
      ...inCollection,
      tmdbId: 3,
      releaseYear: null,
      alreadyInCollection: false,
    };
    api.lookupMovies.mockResolvedValueOnce([inCollection, differentYear, missingYear]);
    const fixture = TestBed.createComponent(MovieLookupComponent);
    const component = fixture.componentInstance;
    const selected = vi.fn();
    component.movieSelected.subscribe(selected);
    vi.useFakeTimers();

    try {
      fixture.componentRef.setInput('searchTerm', 'The Mist');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(350);
      fixture.detectChanges();

      const results = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('[aria-label="TMDb search results"] button');
      expect(results).toHaveLength(3);
      expect(results[0].disabled).toBe(true);
      expect(results[1].disabled).toBe(false);
      expect(results[2].disabled).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Already in collection');
      results[1].click();
      expect(selected).toHaveBeenCalledWith(differentYear);
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('notifies the app when the user session has expired', async () => {
    api.lookupMovies.mockRejectedValueOnce(new HttpErrorResponse({ status: 401 }));
    const fixture = TestBed.createComponent(MovieLookupComponent);
    const sessionExpired = vi.fn();
    fixture.componentInstance.sessionExpired.subscribe(sessionExpired);
    vi.useFakeTimers();

    try {
      fixture.componentRef.setInput('searchTerm', 'Arrival');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(350);
      expect(sessionExpired).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });
});
