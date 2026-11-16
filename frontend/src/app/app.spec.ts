import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MovieApiService } from './movie-api.service';
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
    listMovies: () => Promise.resolve({
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
    const addPriorityButtons = rendered.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Priority"] button');
    expect(addPriorityButtons).toHaveLength(3);
    expect(addPriorityButtons[0].textContent).toContain('High');
    expect(addPriorityButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(addPriorityButtons[2].textContent).toContain('Low');
    app.watchlistEditorOpen.set(false);
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit There Will Be Blood"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

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
    expect(editor?.querySelector('form')?.className).toContain('grid-cols-[minmax(0,1fr)_5rem]');
    expect(ratingButtons?.length).toBe(10);
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 10"]')?.getAttribute('aria-pressed')).toBe('false');

    editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('true');
    editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(editor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('false');
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

  it('shows and hides mobile movie actions from the movie row', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    const movieRow = rendered.querySelector<HTMLButtonElement>('button[aria-label="Actions for Arrival"]');
    expect(movieRow).not.toBeNull();

    movieRow?.click();
    fixture.detectChanges();
    expect(movieRow?.getAttribute('aria-expanded')).toBe('true');
    expect(rendered.querySelector('button[aria-label="Edit Arrival"]')).not.toBeNull();
    expect(rendered.querySelector('button[aria-label="Remove Arrival"]')).not.toBeNull();

    rendered.querySelector<HTMLButtonElement>('button[aria-label="Close movie actions"]')?.click();
    fixture.detectChanges();
    expect(movieRow?.getAttribute('aria-expanded')).toBe('false');
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

  it('opens the edit form in place of the selected movie row', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Actions for Arrival"]')?.click();
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const inlineEditor = rendered.querySelector<HTMLElement>('[aria-labelledby="inline-editor-heading"]');
    expect(inlineEditor).not.toBeNull();
    expect(inlineEditor?.closest('li')).not.toBeNull();
    expect(inlineEditor?.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe('Arrival');
    expect(inlineEditor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 9"]')?.getAttribute('aria-pressed')).toBe('true');
    inlineEditor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(inlineEditor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('true');
    inlineEditor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.click();
    fixture.detectChanges();
    expect(inlineEditor?.querySelector<HTMLButtonElement>('button[aria-label="Rating 8"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(rendered.querySelector('[aria-labelledby="editor-heading"]')).toBeNull();

    Array.from(inlineEditor?.querySelectorAll<HTMLButtonElement>('button[type="button"]') ?? [])
      .find(button => button.textContent?.trim() === 'Cancel')
      ?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="inline-editor-heading"]')).toBeNull();
    expect(rendered.querySelector('button[aria-label="Actions for Arrival"]')).not.toBeNull();
  });

  it('shows delete confirmation in place of the selected movie row', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Actions for Arrival"]')?.click();
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Remove Arrival"]')?.click();
    fixture.detectChanges();

    const confirmation = rendered.querySelector<HTMLElement>('[aria-labelledby="delete-heading"]');
    expect(confirmation).not.toBeNull();
    expect(confirmation?.closest('li')).not.toBeNull();
    expect(confirmation?.textContent).toContain('Remove “Arrival”?');
    expect(rendered.querySelector('button[aria-label="Actions for Arrival"]')).toBeNull();

    confirmation?.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    fixture.detectChanges();
    expect(rendered.querySelector('[aria-labelledby="delete-heading"]')).toBeNull();
    expect(rendered.querySelector('button[aria-label="Actions for Arrival"]')).not.toBeNull();
  });

  it('shows edit field errors after saving with empty required fields', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Actions for Arrival"]')?.click();
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit Arrival"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const inlineEditor = rendered.querySelector<HTMLElement>('[aria-labelledby="inline-editor-heading"]');
    const titleInput = inlineEditor?.querySelector<HTMLInputElement>('input[name="title"]');
    const yearInput = inlineEditor?.querySelector<HTMLInputElement>('input[name="releaseYear"]');
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
    inlineEditor?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(inlineEditor?.textContent).toContain('Enter a movie title.');
    expect(inlineEditor?.textContent).toContain('Enter a valid release year.');
  });
});
