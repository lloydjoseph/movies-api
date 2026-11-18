import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MovieApiService } from '../movie-api.service';
import type { Movie, MoviePage } from '../movie-api.service';
import { CollectionComponent } from './collection';
import type { CollectionView } from './collection.models';

describe('CollectionComponent', () => {
  const movie: Movie = { id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 };
  const listMovies = vi.fn<(query: { page: number; size: number; title: string; ratings?: number[]; includeUnrated?: boolean; sort?: string }) => Promise<MoviePage>>();
  const deleteMovie = vi.fn<(id: number) => Promise<void>>();

  beforeEach(async () => {
    listMovies.mockReset().mockResolvedValue({
      items: [movie],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
      hasNext: false,
    });
    deleteMovie.mockReset().mockResolvedValue();
    await TestBed.configureTestingModule({
      imports: [CollectionComponent],
      providers: [{
        provide: MovieApiService,
        useValue: { listMovies, deleteMovie },
      }],
    }).compileComponents();
  });

  async function createFixture(view?: CollectionView) {
    const fixture = TestBed.createComponent(CollectionComponent);
    if (view) fixture.componentRef.setInput('view', view);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads the catalog and displays its movies', async () => {
    const fixture = await createFixture();

    expect(listMovies).toHaveBeenCalledWith({
      page: 0,
      size: 50,
      title: '',
      ratings: [],
      includeUnrated: false,
      sort: 'rating_desc',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Arrival');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 film');
    fixture.destroy();
  });

  it('publishes filter and sort changes with the persisted view shape', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    const changes: CollectionView[] = [];
    component.viewChange.subscribe(view => changes.push(view));

    component.toggleRating(8);
    component.toggleUnrated();
    component.toggleSort('year');

    expect(changes.at(-1)).toEqual({
      query: '',
      sortBy: 'year_desc',
      selectedRatings: [8],
      includeUnrated: true,
    });
    expect(component.sortDirection('year')).toBe('descending');
    component.toggleSort('year');
    expect(component.sortBy()).toBe('year_asc');
    component.toggleSort('year');
    expect(component.sortBy()).toBe('none');
    fixture.destroy();
  });

  it('loads additional pages without replacing the current page', async () => {
    listMovies
      .mockResolvedValueOnce({
        items: [movie],
        page: 0,
        size: 50,
        totalItems: 2,
        totalPages: 2,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 2, name: 'Moonlight', releaseYear: 2016, rating: null }],
        page: 1,
        size: 50,
        totalItems: 2,
        totalPages: 2,
        hasNext: false,
      });
    const fixture = await createFixture();
    fixture.componentInstance.loadMore();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listMovies).toHaveBeenLastCalledWith({
      page: 1,
      size: 50,
      title: '',
      ratings: [],
      includeUnrated: false,
      sort: 'rating_desc',
    });
    expect(fixture.componentInstance.movies().map(item => item.name)).toEqual(['Arrival', 'Moonlight']);
    fixture.destroy();
  });

  it('offers retry after a catalog request fails', async () => {
    listMovies
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }))
      .mockResolvedValueOnce({
        items: [movie],
        page: 0,
        size: 50,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
      });
    const fixture = await createFixture();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load your movies. Please try again.');

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.trim() === 'Retry')
      ?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listMovies).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Arrival');
    fixture.destroy();
  });

  it('shows an empty state when active filters return no results', async () => {
    listMovies.mockResolvedValue({
      items: [],
      page: 0,
      size: 50,
      totalItems: 0,
      totalPages: 0,
      hasNext: false,
    });
    const fixture = await createFixture({
      query: 'unknown title',
      sortBy: 'rating_desc',
      selectedRatings: [],
      includeUnrated: false,
    });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No matching movies.');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Add a movie to get started.');
    fixture.destroy();
  });

  it('allows undoing a movie removal before it is sent to the server', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    vi.useFakeTimers();

    try {
      component.requestDelete(movie);
      component.confirmDelete();
      expect(component.movies()).toEqual([]);
      expect(component.pendingMovieDeletion()?.movie).toEqual(movie);
      expect(deleteMovie).not.toHaveBeenCalled();

      await component.undoMovieDeletion();
      await vi.advanceTimersByTimeAsync(5000);
      expect(component.movies()).toEqual([movie]);
      expect(deleteMovie).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('commits deletion when the undo window expires or sign-out flushes it', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    vi.useFakeTimers();

    try {
      component.requestDelete(movie);
      component.confirmDelete();
      await vi.advanceTimersByTimeAsync(5000);
      expect(deleteMovie).toHaveBeenCalledWith(1);

      deleteMovie.mockClear();
      component.requestDelete(movie);
      component.confirmDelete();
      expect(await component.flushPendingDeletion()).toBe(true);
      expect(deleteMovie).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('exports every catalog page as a safe CSV download', async () => {
    const fixture = await createFixture();
    listMovies.mockClear()
      .mockResolvedValueOnce({
        items: [{ id: 1, name: '=1+1', releaseYear: 2016, rating: 9 }],
        page: 0,
        size: 100,
        totalItems: 2,
        totalPages: 2,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 2, name: 'Moonlight', releaseYear: 2016, rating: null }],
        page: 1,
        size: 100,
        totalItems: 2,
        totalPages: 2,
        hasNext: false,
      });
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:movie-export');
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    try {
      await fixture.componentInstance.exportMovies();
      expect(listMovies).toHaveBeenNthCalledWith(1, { page: 0, size: 100, title: '', sort: 'none' });
      expect(listMovies).toHaveBeenNthCalledWith(2, { page: 1, size: 100, title: '', sort: 'none' });
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      const blob = createObjectURL.mock.calls[0]?.[0];
      expect(blob).toBeDefined();
      if (!blob) throw new Error('CSV export did not create a blob');
      const csv = await blob.text();
      expect(csv).toContain("\"'=1+1\"");
      expect(csv).toContain('"Moonlight"');
      await vi.advanceTimersByTimeAsync(1000);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      click.mockRestore();
      fixture.destroy();
    }
  });
});
