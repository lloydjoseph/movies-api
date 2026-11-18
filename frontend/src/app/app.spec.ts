import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MovieApiService } from './movie-api.service';
import type { MoviePage } from './movie-api.service';
import { App } from './app';

describe('App', () => {
  const api = {
    currentUser: () => Promise.resolve({ email: 'joseph@example.com', name: 'Joseph Lloyd' }),
    listWatchlist: () => Promise.resolve([{
      id: 7, name: 'There Will Be Blood', notes: 'Recommended by Alex', priority: 'MEDIUM' as const,
    }]),
    addWatchlistItem: vi.fn((name: string, notes: string, priority: 'LOW' | 'MEDIUM' | 'HIGH') =>
      Promise.resolve({ id: 8, name, notes: notes || null, priority })),
    updateWatchlistItem: vi.fn((id: number, name: string, notes: string, priority: 'LOW' | 'MEDIUM' | 'HIGH') =>
      Promise.resolve({ id, name, notes: notes || null, priority })),
    deleteWatchlistItem: vi.fn(() => Promise.resolve()),
    lookupMovies: vi.fn(() => Promise.resolve([])),
    listMovies: (): Promise<MoviePage> => Promise.resolve({
      items: [{ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 }],
      page: 0,
      size: 50,
      totalItems: 1,
      totalPages: 1,
      hasNext: false,
    }),
    createMovie: vi.fn(() => Promise.resolve({ id: 2, name: 'New movie', releaseYear: 2025, rating: null })),
    updateMovie: () => Promise.resolve({ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 }),
    deleteMovie: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  };

  beforeEach(async () => {
    sessionStorage.clear();
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
    expect(rendered.querySelector('h1')?.textContent).toContain('Collection');
    expect(rendered.textContent).toContain('Arrival');
    expect(document.title).toBe('Collection | Joseph’s Movies');
    expect(rendered.textContent).toContain('This product uses the TMDB API but is not endorsed or certified by TMDB.');
    expect(rendered.querySelector('img[alt="The Movie Database (TMDB)"]')).not.toBeNull();
    fixture.componentInstance.selectTab('watchlist');
    expect(document.title).toBe('Watchlist | Joseph’s Movies');
    fixture.componentInstance.selectTab('movies');
    expect(document.title).toBe('Collection | Joseph’s Movies');
  });

  it('reports a rejected catalog request as a loading error', async () => {
    const listMovies = vi.spyOn(api, 'listMovies')
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 400 }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load your movies. Please try again.');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('The movie details were rejected.');
    listMovies.mockRestore();
  });

  it('closes the active dialog and returns to sign-in when the session expires', async () => {
    const createMovie = vi.spyOn(api, 'createMovie')
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 401 }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openCreateForm();
    fixture.detectChanges();
    app.title = 'New movie';
    app.releaseYear = 2025;
    await app.saveMovie();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    expect(app.user()).toBeNull();
    expect(app.editorOpen()).toBe(false);
    expect(rendered.querySelector('dialog[open]')).toBeNull();
    expect(rendered.textContent).toContain('Your session expired. Sign in again to continue.');
    expect(rendered.textContent).toContain('Sign in with Google');
    createMovie.mockRestore();
    fixture.destroy();
  });

  it('returns to sign-in when the watchlist session expires', async () => {
    const listWatchlist = vi.spyOn(api, 'listWatchlist')
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 401 }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const app = fixture.componentInstance;
    app.selectTab('watchlist');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(app.user()).toBeNull();
    expect(app.error()).toBe('Your session expired. Sign in again to continue.');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sign in with Google');
    listWatchlist.mockRestore();
    fixture.destroy();
  });

  it('remembers the collection view for the signed-in account in this tab', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.onCollectionViewChange({
      query: 'arrival',
      sortBy: 'year_asc',
      selectedRatings: [8],
      includeUnrated: true,
    });
    app.selectTab('watchlist');
    fixture.destroy();

    const restored = TestBed.createComponent(App);
    await restored.whenStable();
    const restoredApp = restored.componentInstance;
    expect(restoredApp.collectionView()).toEqual({
      query: 'arrival',
      sortBy: 'year_asc',
      selectedRatings: [8],
      includeUnrated: true,
    });
    expect(restoredApp.activeTab()).toBe('watchlist');
    restored.destroy();
  });

  it('commits a pending removal before signing out', async () => {
    const deleteMovie = vi.spyOn(api, 'deleteMovie');
    const logout = vi.spyOn(api, 'logout');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.requestDelete({ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 });
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[aria-labelledby="delete-heading"] button:last-child')
      ?.click();
    fixture.detectChanges();
    await app.signOut();

    expect(deleteMovie).toHaveBeenCalledWith(1);
    expect(logout).toHaveBeenCalledOnce();
    expect(app.user()).toBeNull();
    deleteMovie.mockRestore();
    logout.mockRestore();
    fixture.destroy();
  });

  it('fills a new movie form from a selected TMDb result', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.openCreateForm();
    fixture.detectChanges();
    expect(app.releaseYear).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="releaseYear"]')?.placeholder)
      .toBe(app.currentYear);
    app.onMovieLookupSelected({
      tmdbId: 329865,
      title: 'Arrival',
      originalTitle: 'Arrival',
      releaseYear: 2016,
      alreadyInCollection: false,
    });

    expect(app.title).toBe('Arrival');
    expect(app.releaseYear).toBe(2016);
    fixture.destroy();
  });

  it('waits for an in-flight timed deletion before signing out', async () => {
    const deleteMovie = vi.spyOn(api, 'deleteMovie');
    const logout = vi.spyOn(api, 'logout');
    let resolveDeletion!: () => void;
    deleteMovie.mockImplementation(() => new Promise<void>(resolve => {
      resolveDeletion = resolve;
    }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const app = fixture.componentInstance;
    vi.useFakeTimers();

    try {
      app.requestDelete({ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 });
      fixture.detectChanges();
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[aria-labelledby="delete-heading"] button'))
        .find(button => button.textContent?.trim() === 'Remove movie')
        ?.click();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(5000);
      expect(deleteMovie).toHaveBeenCalledOnce();

      let signOutCompleted = false;
      const signOut = app.signOut().then(() => { signOutCompleted = true; });
      await Promise.resolve();
      expect(logout).not.toHaveBeenCalled();
      expect(signOutCompleted).toBe(false);

      resolveDeletion();
      await signOut;
      expect(deleteMovie).toHaveBeenCalledOnce();
      expect(logout).toHaveBeenCalledOnce();
      expect(app.user()).toBeNull();
    } finally {
      vi.useRealTimers();
      deleteMovie.mockRestore();
      logout.mockRestore();
      fixture.destroy();
    }
  });

  it('opens the movie add form with a watchlist title and removes it after saving', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance;
    app.selectTab('watchlist');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('There Will Be Blood');
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-watchlist button'))
      .find(button => button.textContent?.includes('I’ve seen it'))
      ?.click();
    fixture.detectChanges();

    expect(app.activeTab()).toBe('movies');
    expect(app.editorOpen()).toBe(true);
    expect(app.title).toBe('There Will Be Blood');
    expect(app.releaseYear).toBeNull();

    app.releaseYear = 2025;
    await app.saveMovie();
    fixture.detectChanges();
    expect(api.createMovie).toHaveBeenCalledWith(
      { name: 'There Will Be Blood', releaseYear: 2025, rating: null }, 7);
    expect(fixture.nativeElement.querySelector('app-watchlist')?.textContent).not.toContain('There Will Be Blood');
  });

  it('uses the edit rating control and layout in the add form', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    Array.from(rendered.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.type === 'button' && button.textContent?.includes('Add movie'))
      ?.click();
    fixture.detectChanges();

    const editor = rendered.querySelector<HTMLElement>('[aria-labelledby="editor-heading"]');
    expect(editor?.parentElement?.querySelector('p')?.textContent?.trim()).toBe('Collection');
    const ratingButtons = editor?.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Rating"] button');
    expect(editor?.querySelector('form')?.className).toContain('grid-cols-1');
    expect(editor?.querySelector('form')?.className).not.toContain('grid-cols-[minmax(0,1fr)_5rem]');
    const addFormActions = editor?.querySelector('form')?.lastElementChild;
    expect(addFormActions?.className).toContain('grid-cols-2');
    expect(addFormActions?.querySelector('button[type="button"]')?.className).toContain('w-full');
    const addButton = addFormActions?.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(addButton?.className).toContain('w-full');
    expect(addButton?.className).toContain('bg-orange-600');
    expect(editor?.textContent).not.toContain('Title and release year are required.');
    expect(editor?.querySelector<HTMLInputElement>('input[name="title"]')?.labels?.[0]?.textContent?.trim()).toBe('Title');
    expect(editor?.querySelector<HTMLInputElement>('input[name="title"]')?.required).toBe(true);
    expect(editor?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(editor?.querySelector('[role="group"][aria-label="Rating"]')?.parentElement?.textContent).toContain('Optional');
    expect(ratingButtons?.length).toBe(10);
    expect(ratingButtons?.[0].className).toContain('rounded-md');
    expect(ratingButtons?.[0].className).toContain('dark:bg-neutral-950');
    expect(editor?.querySelector('[role="group"][aria-label="Rating"]')?.className).toContain('grid-cols-2');
    expect(editor?.querySelector('[role="group"][aria-label="Rating"]')?.className).toContain('sm:grid-cols-5');
    expect(editor?.querySelector('[role="group"][aria-label="Rating"]')?.className).toContain('lg:grid-cols-10');
    expect(ratingButtons?.[0].className).toContain('w-full');
    expect(ratingButtons?.[0].className).not.toContain('border-r');
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 10"]')?.getAttribute('aria-pressed')).toBe('false');

    editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.className).toContain('border-transparent');
    editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.className).toContain('border-stone-300');
  });

  it('shows an inline add or edit summary with table-style movie details', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance;
    const rendered = fixture.nativeElement as HTMLElement;

    app.openCreateForm();
    app.title = 'New movie';
    app.releaseYear = 2025;
    app.rating = null;
    await app.saveMovie();
    fixture.detectChanges();

    let confirmation = rendered.querySelector<HTMLElement>('section[aria-live="polite"]');
    expect(confirmation?.textContent).toContain('New movie');
    expect(confirmation?.textContent).toContain('2025');
    expect(confirmation?.textContent).toContain('Unrated');
    expect(confirmation?.textContent).toContain('Add');
    expect(confirmation?.classList.contains('bg-stone-100')).toBe(true);
    expect(confirmation?.classList.contains('fixed')).toBe(false);
    expect(rendered.querySelector('app-collection')?.previousElementSibling).toBe(confirmation);

    app.closeSaveConfirmation();
    app.openEditForm({ id: 1, name: 'Arrival', releaseYear: 2016, rating: 9 });
    app.title = 'Arrival Updated';
    app.releaseYear = 2017;
    app.rating = 8;
    await app.saveMovie();
    fixture.detectChanges();

    confirmation = rendered.querySelector<HTMLElement>('section[aria-live="polite"]');
    expect(confirmation?.textContent).toContain('Arrival Updated');
    expect(confirmation?.textContent).toContain('2017');
    expect(confirmation?.textContent).toContain('8 / 10');
    expect(confirmation?.textContent).toContain('Edit');
    expect(confirmation?.querySelector('button')).toBeNull();
    expect(confirmation?.querySelector('[style*="background-color"]')).not.toBeNull();

    app.closeSaveConfirmation();
    fixture.detectChanges();
    expect(rendered.querySelector('section[aria-live="polite"]')).toBeNull();
  });

  it('fades and removes the save notification after three seconds', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const app = fixture.componentInstance;

    vi.useFakeTimers();
    try {
      app.openCreateForm();
      app.title = 'New movie';
      app.releaseYear = 2025;
      await app.saveMovie();
      fixture.detectChanges();

      vi.advanceTimersByTime(2700);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('section[aria-live="polite"]')?.classList.contains('opacity-0')).toBe(true);

      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('section[aria-live="polite"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an edit column that opens the movie editor', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    const movieRow = rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]');
    expect(movieRow).not.toBeNull();
    expect(movieRow?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(movieRow?.className).toContain('size-10');
    const editHeader = Array.from(rendered.querySelectorAll('span'))
      .find(span => span.textContent?.trim() === 'Edit');
    expect(editHeader?.className).toContain('w-10');
    movieRow?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="editor-heading"]')).not.toBeNull();
    expect(rendered.querySelector('button[aria-label="Delete Arrival"]')).not.toBeNull();
  });

  it('opens the edit form in a modal above the collection', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const editor = rendered.querySelector<HTMLElement>('[aria-labelledby="editor-heading"]');
    expect(editor).not.toBeNull();
    expect(editor?.closest('dialog')?.open).toBe(true);
    expect(editor?.closest('dialog')?.className).toContain('lg:max-w-2xl');
    expect(editor?.closest('li')).toBeNull();
    expect(editor?.className).toContain('min-h-full');
    expect(editor?.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe('Arrival');
    const editFormActions = editor?.querySelector('form')?.lastElementChild;
    expect(editFormActions?.className).toContain('grid-cols-2');
    const deleteButton = editFormActions?.querySelector<HTMLButtonElement>('[aria-label="Delete Arrival"]');
    expect(deleteButton?.parentElement?.className).toContain('col-span-2');
    expect(deleteButton?.parentElement?.className).toContain('border-t');
    expect(deleteButton?.className).toContain('border-red-300');
    expect(deleteButton?.className).toContain('bg-white');
    const saveButton = editFormActions?.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(saveButton?.className).toContain('bg-stone-900');
    expect(saveButton?.className).toContain('dark:bg-white');
    expect(saveButton?.className).toContain('dark:text-stone-900');
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 9"]')?.getAttribute('aria-pressed')).toBe('true');
    editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('true');
    editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('false');

    Array.from(editor?.querySelectorAll<HTMLButtonElement>('button[type="button"]') ?? [])
      .find(button => button.textContent?.trim() === 'Cancel')
      ?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="editor-heading"]')).toBeNull();
    expect(rendered.querySelector('button[aria-label="Edit Arrival"]')).not.toBeNull();
  });

  it('closes the editor when Escape is pressed', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.openCreateForm();
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>('#editor-dialog');
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog?.dispatchEvent(cancelEvent);
    fixture.detectChanges();

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog?.open).toBe(false);
    expect(app.editorOpen()).toBe(false);
  });

  it('shows a compact delete confirmation dialog', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rendered.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe('Arrival');
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Delete Arrival"]')?.click();
    fixture.detectChanges();

    const confirmation = rendered.querySelector<HTMLElement>('[aria-labelledby="delete-heading"]');
    expect(confirmation).not.toBeNull();
    expect(confirmation?.closest('dialog')?.open).toBe(true);
    expect(confirmation?.closest('li')).toBeNull();
    expect(confirmation?.textContent).toContain('Remove “Arrival”?');

    confirmation?.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="delete-heading"]')).toBeNull();
    expect(rendered.querySelector('[aria-labelledby="editor-heading"]')).not.toBeNull();
    expect(rendered.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe('Arrival');
    Array.from(rendered.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.trim() === 'Cancel')
      ?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('button[aria-label="Edit Arrival"]')).not.toBeNull();

    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Delete Arrival"]')?.click();
    fixture.detectChanges();
    Array.from(rendered.querySelectorAll<HTMLButtonElement>('[aria-labelledby="delete-heading"] button'))
      .find(button => button.textContent?.trim() === 'Remove movie')
      ?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="editor-heading"]')).toBeNull();
    expect(rendered.querySelector('[role="status"]')?.textContent).toContain('“Arrival” removed.');
    Array.from(rendered.querySelectorAll<HTMLButtonElement>('[role="status"] button'))
      .find(button => button.textContent?.trim() === 'Undo')
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('disables the movie submit button until required fields are valid', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const editor = rendered.querySelector<HTMLElement>('[aria-labelledby="editor-heading"]');
    const titleInput = editor?.querySelector<HTMLInputElement>('input[name="title"]');
    const yearInput = editor?.querySelector<HTMLInputElement>('input[name="releaseYear"]');
    expect(titleInput).not.toBeNull();
    expect(yearInput).not.toBeNull();

    if (titleInput && yearInput) {
      titleInput.value = '';
      titleInput.dispatchEvent(new Event('input'));
      yearInput.value = '';
      yearInput.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    const submitButton = editor?.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitButton?.disabled).toBe(true);

    if (titleInput && yearInput) {
      titleInput.value = 'Arrival';
      titleInput.dispatchEvent(new Event('input'));
      yearInput.value = '2024';
      yearInput.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    expect(submitButton?.disabled).toBe(false);
  });
});
