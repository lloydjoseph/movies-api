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

  it('remembers the collection view for the signed-in account in this tab', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.onQueryChange('arrival');
    app.setSort('year_asc');
    app.toggleRating(8);
    app.toggleUnrated();
    app.selectTab('watchlist');
    fixture.destroy();

    const restored = TestBed.createComponent(App);
    await restored.whenStable();
    const restoredApp = restored.componentInstance;
    expect(restoredApp.query()).toBe('arrival');
    expect(restoredApp.sortBy()).toBe('year_asc');
    expect(restoredApp.selectedRatings()).toEqual([8]);
    expect(restoredApp.includeUnrated()).toBe(true);
    expect(restoredApp.activeTab()).toBe('watchlist');
    restored.destroy();
  });

  it('allows undoing a movie removal before it is sent to the server', async () => {
    const deleteMovie = vi.spyOn(api, 'deleteMovie');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const movie = app.movies()[0];
    vi.useFakeTimers();

    try {
      app.deletingMovie.set(movie);
      app.confirmDelete();
      expect(app.movies()).toEqual([]);
      expect(app.pendingMovieDeletion()?.movie).toEqual(movie);
      expect(deleteMovie).not.toHaveBeenCalled();

      await app.undoMovieDeletion();
      await vi.advanceTimersByTimeAsync(5000);
      expect(app.movies()).toEqual([movie]);
      expect(deleteMovie).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      deleteMovie.mockRestore();
      fixture.destroy();
    }
  });

  it('deletes a movie when the undo window expires', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const deleteMovie = vi.spyOn(api, 'deleteMovie');
    const app = fixture.componentInstance;
    vi.useFakeTimers();

    try {
      app.deletingMovie.set(app.movies()[0]);
      app.confirmDelete();
      await vi.advanceTimersByTimeAsync(5000);
      expect(deleteMovie).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
      deleteMovie.mockRestore();
      fixture.destroy();
    }
  });

  it('commits a pending removal before signing out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const deleteMovie = vi.spyOn(api, 'deleteMovie');
    const logout = vi.spyOn(api, 'logout');
    const app = fixture.componentInstance;

    app.deletingMovie.set(app.movies()[0]);
    app.confirmDelete();
    await app.signOut();

    expect(deleteMovie).toHaveBeenCalledWith(1);
    expect(logout).toHaveBeenCalledOnce();
    expect(app.user()).toBeNull();
    deleteMovie.mockRestore();
    logout.mockRestore();
    fixture.destroy();
  });

  it('exports every catalog page as a CSV download', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const listMovies = vi.spyOn(api, 'listMovies')
      .mockResolvedValueOnce({
        items: [{ id: 1, name: '=1+1', releaseYear: 2016, rating: 9 }],
        page: 0, size: 100, totalItems: 2, totalPages: 2, hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 2, name: 'Moonlight', releaseYear: 2016, rating: null }],
        page: 1, size: 100, totalItems: 2, totalPages: 2, hasNext: false,
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
      listMovies.mockRestore();
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
    app.markWatchlistItemSeen({
      id: 7, name: 'There Will Be Blood', notes: 'Recommended by Alex', priority: 'MEDIUM',
    });
    fixture.detectChanges();

    expect(app.activeTab()).toBe('movies');
    expect(app.editorOpen()).toBe(true);
    expect(app.title).toBe('There Will Be Blood');

    await app.saveMovie();
    expect(api.createMovie).toHaveBeenCalledWith(
      { name: 'There Will Be Blood', releaseYear: new Date().getFullYear(), rating: null }, 7);
    expect(app.watchlist()).toHaveLength(0);
  });

  it('displays and edits watchlist notes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.selectTab('watchlist');
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    expect(rendered.textContent).toContain('Recommended by Alex');
    app.openWatchlistForm();
    fixture.detectChanges();
    const watchlistEditor = rendered.querySelector<HTMLElement>('dialog[open] [aria-labelledby="watchlist-editor-heading"]');
    expect(watchlistEditor).not.toBeNull();
    expect(watchlistEditor?.className).toContain('min-h-full');
    const watchlistActions = watchlistEditor?.querySelector('form')?.lastElementChild;
    expect(watchlistActions?.className).toContain('grid-cols-2');
    expect(watchlistActions?.querySelector('button[type="button"]')?.className).toContain('w-full');
    expect(watchlistActions?.querySelector('button[type="submit"]')?.className).toContain('w-full');
    expect(watchlistEditor?.querySelector('[aria-label="Priority"]')?.className).toContain('w-full');
    expect(watchlistEditor?.querySelector('[aria-label="Priority"]')?.className).not.toContain('sm:w-72');
    const addPriorityButtons = rendered.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Priority"] button');
    expect(addPriorityButtons).toHaveLength(3);
    expect(addPriorityButtons[0].textContent).toContain('High');
    expect(addPriorityButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(addPriorityButtons[2].textContent).toContain('Low');
    addPriorityButtons[0].click();
    fixture.detectChanges();
    addPriorityButtons[1].click();
    fixture.detectChanges();
    expect(addPriorityButtons[1].className).toContain('bg-indigo-100');
    expect(addPriorityButtons[1].className).toContain('dark:bg-indigo-950');
    app.closeWatchlistForm();
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit There Will Be Blood"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rendered.querySelector('dialog[open] [aria-labelledby="watchlist-edit-heading"]')).not.toBeNull();
    const notes = rendered.querySelector<HTMLTextAreaElement>('textarea[name="editWatchlistNotes"]');
    expect(app.editingWatchlistNotes).toBe('Recommended by Alex');
    expect(notes?.value).toBe('Recommended by Alex');
    expect(rendered.textContent).toContain('19/500');
    const editPriorityButtons = rendered.querySelector<HTMLFormElement>('form:has(textarea[name="editWatchlistNotes"])')
      ?.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Priority"] button');
    editPriorityButtons?.[0].click();
    fixture.detectChanges();
    expect(editPriorityButtons?.[0].getAttribute('aria-pressed')).toBe('true');

    app.editingWatchlistNotes = 'Watch on a big screen';
    await app.saveWatchlistEdit(app.watchlist()[0]);
    fixture.detectChanges();

    expect(api.updateWatchlistItem).toHaveBeenCalledWith(
      7, 'There Will Be Blood', 'Watch on a big screen', 'HIGH');
    expect(rendered.textContent).toContain('Watch on a big screen');
    expect(rendered.textContent).toContain('High');
    expect(rendered.querySelector('[aria-label="Priority: High"] svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('confirms before removing a watchlist item', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.selectTab('watchlist');
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Remove There Will Be Blood from watchlist"]')?.click();
    fixture.detectChanges();

    const confirmation = rendered.querySelector<HTMLElement>('[aria-labelledby="watchlist-delete-heading-7"]');
    expect(confirmation?.textContent).toContain('Remove “There Will Be Blood” from your watchlist?');
    expect(confirmation?.closest('dialog')?.open).toBe(true);
    expect(confirmation?.closest('li')).toBeNull();
    expect(api.deleteWatchlistItem).not.toHaveBeenCalled();

    confirmation?.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="watchlist-delete-heading-7"]')).toBeNull();
    expect(rendered.querySelector('button[aria-label="Remove There Will Be Blood from watchlist"]')).not.toBeNull();
    expect(api.deleteWatchlistItem).not.toHaveBeenCalled();

    app.requestRemoveWatchlistItem(app.watchlist()[0]);
    await app.confirmRemoveWatchlistItem(app.watchlist()[0]);
    expect(api.deleteWatchlistItem).toHaveBeenCalledWith(7);
    expect(app.watchlist()).toHaveLength(0);
  });

  it('explains when a duplicate title is already in a list', async () => {
    api.addWatchlistItem.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const app = fixture.componentInstance;
    app.watchlistTitle = 'Arrival';
    await app.saveWatchlistItem();

    expect(app.error()).toBe('That title is already in your collection or watchlist.');
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
    expect(editor?.querySelector('label')?.textContent?.trim()).toBe('Title');
    expect(editor?.querySelector<HTMLInputElement>('input[name="title"]')?.required).toBe(true);
    expect(editor?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(editor?.querySelector('[role="group"][aria-label="Rating"]')?.parentElement?.textContent).toContain('Optional');
    expect(ratingButtons?.length).toBe(10);
    expect(ratingButtons?.[0].className).toContain('rounded-md');
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
    expect(rendered.querySelector('[aria-label="Movie collection"]')?.previousElementSibling).toBe(confirmation);

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

  it('renders sort controls and defaults to rating descending', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app.sortBy()).toBe('rating_desc');
    expect(app.sortDirection('rating')).toBe('descending');
    expect(app.sortDirection('year')).toBe('unsorted');
    expect(app.sortDirection('title')).toBe('unsorted');

    app.toggleSort('rating');
    expect(app.sortBy()).toBe('rating_asc');
    expect(app.sortDirection('rating')).toBe('ascending');

    app.toggleSort('rating');
    expect(app.sortBy()).toBe('none');
    expect(app.sortDirection('rating')).toBe('unsorted');

    app.toggleSort('rating');
    expect(app.sortBy()).toBe('rating_desc');
    expect(app.sortDirection('rating')).toBe('descending');

    app.toggleSort('year');
    expect(app.sortBy()).toBe('year_desc');
    expect(app.sortDirection('year')).toBe('descending');
    expect(app.sortDirection('rating')).toBe('unsorted');

    app.toggleSort('year');
    expect(app.sortBy()).toBe('year_asc');
    app.toggleSort('year');
    expect(app.sortBy()).toBe('none');
  });

  it('allows toggling rating number filters', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app.isAllSelected()).toBe(true);

    app.toggleRating(9);
    expect(app.isAllSelected()).toBe(false);
    expect(app.isRatingSelected(9)).toBe(true);
    expect(app.isRatingSelected(8)).toBe(false);

    app.toggleRating(8);
    expect(app.isRatingSelected(9)).toBe(true);
    expect(app.isRatingSelected(8)).toBe(true);

    app.selectAllRatings();
    expect(app.isAllSelected()).toBe(true);
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

  it('shows a matching-movies message when active filters return no results', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance;
    app.movies.set([]);
    app.totalItems.set(0);
    app.query.set('unknown title');
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    expect(rendered.textContent).toContain('No matching movies.');
    expect(rendered.textContent).not.toContain('Add a movie to get started.');
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

    const app = fixture.componentInstance;
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
    expect(app.pendingMovieDeletion()?.movie.name).toBe('Arrival');
    await app.undoMovieDeletion();
    await fixture.whenStable();
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
