import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideArrowUpDown,
  LucideCircleUserRound,
  LucideDownload,
  LucideMinus,
  LucideMoon,
  LucidePlus,
  LucideSearch,
  LucideSun,
} from '@lucide/angular';
import { CatalogQuery, Movie, MovieApiService, MovieInput, MovieSort, SignedInUser, WatchlistItem, WatchlistPriority } from './movie-api.service';

type Theme = 'light' | 'dark';
type SortDirection = 'ascending' | 'descending' | 'unsorted';
type CollectionViewState = {
  query: string;
  sortBy: MovieSort;
  selectedRatings: number[];
  includeUnrated: boolean;
  activeTab: 'movies' | 'watchlist';
};
type PendingMovieDeletion = {
  movie: Movie;
  index: number;
};
type SaveConfirmation = {
  action: 'created' | 'updated';
  name: string;
  releaseYear: number;
  rating: number | null;
};

function isMovieSort(value: unknown): value is MovieSort {
  return value === 'rating_desc' || value === 'rating_asc'
    || value === 'year_desc' || value === 'year_asc'
    || value === 'title_asc' || value === 'title_desc' || value === 'none';
}

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    LucideArrowDown,
    LucideArrowUp,
    LucideArrowUpDown,
    LucideCircleUserRound,
    LucideDownload,
    LucideMinus,
    LucideMoon,
    LucidePlus,
    LucideSearch,
    LucideSun,
  ],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private readonly api = inject(MovieApiService);
  private readonly documentTitle = inject(Title);

  readonly user = signal<SignedInUser | null>(null);
  readonly movies = signal<Movie[]>([]);
  readonly watchlist = signal<WatchlistItem[]>([]);
  readonly activeTab = signal<'movies' | 'watchlist'>('movies');
  readonly watchlistLoading = signal(false);
  readonly watchlistEditorOpen = signal(false);
  readonly editingWatchlistItemId = signal<number | null>(null);
  readonly deletingWatchlistItemId = signal<number | null>(null);
  readonly savingWatchlistItem = signal(false);
  readonly pendingWatchlistItemId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly loadingMovies = signal(false);
  readonly loadingMore = signal(false);
  readonly exporting = signal(false);
  readonly totalItems = signal(0);
  readonly hasNext = signal(false);
  readonly page = signal(0);
  readonly saving = signal(false);
  readonly error = signal(this.loginFailureMessage());
  readonly query = signal('');
  readonly sortBy = signal<MovieSort>('rating_desc');
  readonly selectedRatings = signal<number[]>([]);
  readonly includeUnrated = signal<boolean>(false);
  readonly editorOpen = signal(false);
  readonly editingMovie = signal<Movie | null>(null);
  readonly saveConfirmation = signal<SaveConfirmation | null>(null);
  readonly saveConfirmationFading = signal(false);
  readonly deletingMovie = signal<Movie | null>(null);
  readonly pendingMovieDeletion = signal<PendingMovieDeletion | null>(null);
  readonly activeMovieActionsId = signal<number | null>(null);
  readonly theme = signal<Theme>(this.readThemePreference());

  title = '';
  watchlistTitle = '';
  watchlistNotes = '';
  watchlistPriority: WatchlistPriority = 'MEDIUM';
  editingWatchlistTitle = '';
  editingWatchlistNotes = '';
  editingWatchlistPriority: WatchlistPriority = 'MEDIUM';
  releaseYear: number | null = new Date().getFullYear();
  rating: number | null = null;

  readonly visibleMovies = computed(() => this.movies());

  private readonly pageSize = 50;
  private requestId = 0;
  private watchlistRequestId = 0;
  private queryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMovieDeleteTimer: ReturnType<typeof setTimeout> | null = null;
  private saveConfirmationTimer: ReturnType<typeof setTimeout> | null = null;
  private saveConfirmationDismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.updateDocumentTitle();
    void this.loadSession();
  }

  ngOnDestroy(): void {
    if (this.queryTimer) clearTimeout(this.queryTimer);
    if (this.pendingMovieDeletion()) {
      void this.commitPendingMovieDeletion();
    } else {
      this.clearPendingMovieDeleteTimer();
    }
    this.clearSaveConfirmationTimers();
  }

  async loadSession(): Promise<void> {
    this.loading.set(true);
    this.error.set(this.loginFailureMessage());

    try {
      const user = await this.api.currentUser();
      this.user.set(user);
      this.restoreCollectionView(user.email);
      await this.loadMovies(true);
      if (this.activeTab() === 'watchlist') await this.loadWatchlist();
    } catch (error) {
      this.handleSessionError(error);
    } finally {
      this.loading.set(false);
    }
  }

  beginSignIn(): void {
    window.location.assign('/oauth2/authorization/google');
  }

  async signOut(): Promise<void> {
    this.error.set('');
    try {
      if (this.pendingMovieDeletion() && !await this.commitPendingMovieDeletion()) return;
      await this.api.logout();
      this.user.set(null);
      this.movies.set([]);
      this.watchlist.set([]);
      this.totalItems.set(0);
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not sign out. Please try again.'));
    }
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('josephs-movies-theme', nextTheme);
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  }

  onSortChange(value: string): void {
    this.sortBy.set(value as MovieSort);
    this.persistCollectionView();
    void this.loadMovies(true);
  }

  openCreateForm(): void {
    this.pendingWatchlistItemId.set(null);
    this.editingMovie.set(null);
    this.title = '';
    this.releaseYear = new Date().getFullYear();
    this.rating = null;
    this.editorOpen.set(true);
  }

  selectTab(tab: 'movies' | 'watchlist'): void {
    this.activeTab.set(tab);
    this.persistCollectionView();
    this.updateDocumentTitle();
    if (tab === 'watchlist') void this.loadWatchlist();
  }

  openWatchlistForm(): void {
    this.watchlistTitle = '';
    this.watchlistNotes = '';
    this.watchlistPriority = 'MEDIUM';
    this.watchlistEditorOpen.set(true);
  }

  async saveWatchlistItem(): Promise<void> {
    const name = this.watchlistTitle.trim();
    if (!name || this.savingWatchlistItem()) return;

    this.savingWatchlistItem.set(true);
    this.error.set('');
    try {
      const item = await this.api.addWatchlistItem(
        name, this.watchlistNotes.trim(), this.watchlistPriority);
      this.watchlist.update(items => [...items, item].sort((a, b) => a.name.localeCompare(b.name)));
      this.watchlistEditorOpen.set(false);
      this.watchlistTitle = '';
      this.watchlistNotes = '';
      this.watchlistPriority = 'MEDIUM';
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not add the title to your watchlist. Please try again.'));
    } finally {
      this.savingWatchlistItem.set(false);
    }
  }

  openWatchlistEdit(item: WatchlistItem): void {
    this.editingWatchlistItemId.set(item.id);
    this.editingWatchlistTitle = item.name;
    this.editingWatchlistNotes = item.notes ?? '';
    this.editingWatchlistPriority = item.priority;
  }

  cancelWatchlistEdit(): void {
    this.editingWatchlistItemId.set(null);
    this.editingWatchlistTitle = '';
    this.editingWatchlistNotes = '';
    this.editingWatchlistPriority = 'MEDIUM';
  }

  async saveWatchlistEdit(item: WatchlistItem): Promise<void> {
    const name = this.editingWatchlistTitle.trim();
    if (!name || this.savingWatchlistItem()) return;

    this.savingWatchlistItem.set(true);
    this.error.set('');
    try {
      const updated = await this.api.updateWatchlistItem(
        item.id, name, this.editingWatchlistNotes.trim(), this.editingWatchlistPriority);
      this.watchlist.update(items => items
        .map(current => current.id === item.id ? updated : current)
        .sort((a, b) => a.name.localeCompare(b.name)));
      this.cancelWatchlistEdit();
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not update the watchlist item. Please try again.'));
    } finally {
      this.savingWatchlistItem.set(false);
    }
  }

  requestRemoveWatchlistItem(item: WatchlistItem): void {
    this.cancelWatchlistEdit();
    this.deletingWatchlistItemId.set(item.id);
  }

  cancelRemoveWatchlistItem(): void {
    this.deletingWatchlistItemId.set(null);
  }

  async confirmRemoveWatchlistItem(item: WatchlistItem): Promise<void> {
    this.error.set('');
    try {
      await this.api.deleteWatchlistItem(item.id);
      this.watchlist.update(items => items.filter(current => current.id !== item.id));
      this.cancelRemoveWatchlistItem();
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not remove the title from your watchlist. Please try again.'));
    }
  }

  priorityLabel(priority: WatchlistPriority): string {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  }

  markWatchlistItemSeen(item: WatchlistItem): void {
    this.selectTab('movies');
    this.pendingWatchlistItemId.set(item.id);
    this.editingMovie.set(null);
    this.deletingMovie.set(null);
    this.title = item.name;
    this.releaseYear = new Date().getFullYear();
    this.rating = null;
    this.editorOpen.set(true);
  }

  openEditForm(movie: Movie, event?: Event): void {
    this.transitionMovieRow(event, () => {
      this.activeMovieActionsId.set(null);
      this.deletingMovie.set(null);
      this.editingMovie.set(movie);
      this.title = movie.name;
      this.releaseYear = movie.releaseYear;
      this.rating = movie.rating;
      this.editorOpen.set(true);
    });
  }

  requestDelete(movie: Movie, event?: Event): void {
    if (this.pendingMovieDeletion()) return;
    this.transitionMovieRow(event, () => {
      this.activeMovieActionsId.set(null);
      this.editingMovie.set(null);
      this.editorOpen.set(false);
      this.deletingMovie.set(movie);
    });
  }

  cancelDelete(event?: Event): void {
    this.transitionMovieRow(event, () => this.deletingMovie.set(null));
  }

  toggleMovieActions(movieId: number): void {
    if (this.pendingMovieDeletion()) return;
    this.activeMovieActionsId.update(current => current === movieId ? null : movieId);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.persistCollectionView();
    if (this.queryTimer !== null) clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => void this.loadMovies(true), 250);
  }

  isAllSelected(): boolean {
    return this.selectedRatings().length === 0 && !this.includeUnrated();
  }

  isRatingSelected(score: number): boolean {
    return this.selectedRatings().includes(score);
  }

  isUnratedSelected(): boolean {
    return this.includeUnrated();
  }

  selectAllRatings(): void {
    this.selectedRatings.set([]);
    this.includeUnrated.set(false);
    this.persistCollectionView();
    void this.loadMovies(true);
  }

  toggleRating(score: number): void {
    const current = this.selectedRatings();
    if (current.includes(score)) {
      this.selectedRatings.set(current.filter(s => s !== score));
    } else {
      this.selectedRatings.set([...current, score].sort((a, b) => b - a));
    }
    this.persistCollectionView();
    void this.loadMovies(true);
  }

  toggleUnrated(): void {
    this.includeUnrated.update(val => !val);
    this.persistCollectionView();
    void this.loadMovies(true);
  }

  setSort(sort: MovieSort): void {
    this.sortBy.set(sort);
    this.persistCollectionView();
    void this.loadMovies(true);
  }

  sortDirection(field: 'rating' | 'year' | 'title'): SortDirection {
    const current = this.sortBy();
    if (field === 'rating') {
      if (current === 'rating_desc') return 'descending';
      if (current === 'rating_asc') return 'ascending';
      return 'unsorted';
    }
    if (field === 'year') {
      if (current === 'year_desc') return 'descending';
      if (current === 'year_asc') return 'ascending';
      return 'unsorted';
    }
    if (field === 'title') {
      if (current === 'title_asc') return 'ascending';
      if (current === 'title_desc') return 'descending';
      return 'unsorted';
    }
    return 'unsorted';
  }

  toggleSort(field: 'rating' | 'year' | 'title'): void {
    const current = this.sortBy();
    if (field === 'rating') {
      if (current === 'rating_desc') this.setSort('rating_asc');
      else if (current === 'rating_asc') this.setSort('none');
      else this.setSort('rating_desc');
    } else if (field === 'year') {
      if (current === 'year_desc') this.setSort('year_asc');
      else if (current === 'year_asc') this.setSort('none');
      else this.setSort('year_desc');
    } else if (field === 'title') {
      if (current === 'title_asc') this.setSort('title_desc');
      else if (current === 'title_desc') this.setSort('none');
      else this.setSort('title_asc');
    }
  }

  loadMore(): void {
    if (this.hasNext() && !this.loadingMore()) void this.loadMovies(false);
  }

  closeEditor(event?: Event): void {
    if (this.saving()) return;

    if (!this.editingMovie()) {
      this.editorOpen.set(false);
      this.pendingWatchlistItemId.set(null);
      return;
    }

    const target = event?.target;
    const panel = target instanceof Element ? target.closest<HTMLElement>('.editor-panel') : null;
    if (panel && typeof panel.animate === 'function' && !this.prefersReducedMotion()) {
      const animation = panel.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
        { duration: 140, easing: 'ease-in', fill: 'forwards' },
      );
      animation.onfinish = () => this.collapseEditorRow(event);
      return;
    }

    this.collapseEditorRow(event);
  }

  private collapseEditorRow(event?: Event): void {
    this.transitionMovieRow(event, () => {
      this.editorOpen.set(false);
      this.editingMovie.set(null);
      this.pendingWatchlistItemId.set(null);
    });
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private transitionMovieRow(event: Event | undefined, update: () => void): void {
    const target = event?.target;
    const row = target instanceof Element ? target.closest<HTMLElement>('[data-movie-row]') : null;
    if (!row || typeof requestAnimationFrame !== 'function' || typeof row.animate !== 'function' || this.prefersReducedMotion()) {
      update();
      return;
    }

    const startHeight = row.getBoundingClientRect().height;
    row.style.height = `${startHeight}px`;
    row.style.overflow = 'hidden';
    update();

    requestAnimationFrame(() => {
      if (!row.isConnected) return;
      row.style.height = 'auto';
      const endHeight = row.getBoundingClientRect().height;
      row.style.height = `${startHeight}px`;
      void row.offsetHeight;

      const animation = row.animate(
        [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
        { duration: 180, easing: 'ease-in-out' },
      );
      animation.onfinish = () => {
        row.style.height = '';
        row.style.overflow = '';
      };
    });
  }

  async saveMovie(): Promise<void> {
    if (!this.title.trim() || !this.releaseYear || this.releaseYear < 1) return;

    const movie: MovieInput = {
      name: this.title.trim(),
      releaseYear: Number(this.releaseYear),
      rating: this.rating === null ? null : Number(this.rating),
    };

    this.saving.set(true);
    this.error.set('');
    try {
      const current = this.editingMovie();
      if (current) await this.api.updateMovie(current.id, movie);
      else await this.api.createMovie(movie, this.pendingWatchlistItemId() ?? undefined);
      const watchlistItemId = current ? null : this.pendingWatchlistItemId();

      this.editorOpen.set(false);
      this.pendingWatchlistItemId.set(null);
      this.clearSaveConfirmationTimers();
      this.saveConfirmationFading.set(false);
      this.saveConfirmation.set({
        action: current ? 'updated' : 'created',
        name: movie.name,
        releaseYear: movie.releaseYear,
        rating: movie.rating,
      });
      this.saveConfirmationTimer = setTimeout(() => {
        this.saveConfirmationFading.set(true);
        this.saveConfirmationDismissTimer = setTimeout(() => {
          this.saveConfirmation.set(null);
          this.saveConfirmationFading.set(false);
          this.saveConfirmationDismissTimer = null;
        }, 300);
        this.saveConfirmationTimer = null;
      }, 2700);
      await this.reloadMovies();
      if (watchlistItemId !== null) {
        this.watchlist.update(items => items.filter(item => item.id !== watchlistItemId));
      }
    } catch (error) {
      this.error.set(this.errorMessage(
        error,
        'Could not save the movie. Check the details and try again.',
        'The movie details were rejected. Check the title, year, and rating.',
      ));
    } finally {
      this.saving.set(false);
    }
  }

  closeSaveConfirmation(): void {
    this.clearSaveConfirmationTimers();
    this.saveConfirmation.set(null);
    this.saveConfirmationFading.set(false);
  }

  private clearSaveConfirmationTimers(): void {
    if (this.saveConfirmationTimer) clearTimeout(this.saveConfirmationTimer);
    if (this.saveConfirmationDismissTimer) clearTimeout(this.saveConfirmationDismissTimer);
    this.saveConfirmationTimer = null;
    this.saveConfirmationDismissTimer = null;
  }

  confirmDelete(): void {
    const movie = this.deletingMovie();
    if (!movie || this.pendingMovieDeletion()) return;

    this.error.set('');
    const index = this.movies().findIndex(current => current.id === movie.id);
    this.deletingMovie.set(null);
    if (index >= 0) {
      this.movies.update(current => current.filter(item => item.id !== movie.id));
      this.totalItems.update(count => Math.max(0, count - 1));
    }
    this.pendingMovieDeletion.set({ movie, index });
    this.pendingMovieDeleteTimer = setTimeout(() => void this.commitPendingMovieDeletion(), 5000);
  }

  async undoMovieDeletion(): Promise<void> {
    const pending = this.pendingMovieDeletion();
    if (!pending) return;

    this.error.set('');
    this.clearPendingMovieDeleteTimer();
    this.pendingMovieDeletion.set(null);
    if (pending.index >= 0) {
      this.movies.update(current => current.some(movie => movie.id === pending.movie.id)
        ? current
        : [...current.slice(0, pending.index), pending.movie, ...current.slice(pending.index)]);
      this.totalItems.update(count => count + 1);
    }
    await this.reloadMovies();
  }

  async exportMovies(): Promise<void> {
    if (this.exporting() || this.pendingMovieDeletion()) return;

    this.exporting.set(true);
    this.error.set('');
    try {
      const movies: Movie[] = [];
      let page = 0;
      while (true) {
        const result = await this.api.listMovies({
          page,
          size: 100,
          title: '',
          sort: 'none',
        });
        movies.push(...result.items);
        if (!result.hasNext) break;
        page = result.page + 1;
      }

      const rows = [
        ['Title', 'Release year', 'Rating'].map(value => this.csvField(value)).join(','),
        ...movies.map(movie => [
          this.csvField(movie.name),
          this.csvField(movie.releaseYear),
          this.csvField(movie.rating),
        ].join(',')),
      ];
      const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `movies-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not export your movies. Please try again.'));
    } finally {
      this.exporting.set(false);
    }
  }

  ratingColor(value: number | null): string {
    if (value === null) return '#e8e6e1';
    const colors = ['#c75146', '#cf6748', '#d77d4a', '#df944c', '#dba84e', '#bdad50', '#98ad54', '#72a95c', '#50a36a', '#319875'];
    return colors[value - 1] ?? '#e8e6e1';
  }

  ratingTextColor(value: number | null): string {
    return value !== null && value >= 5 ? '#173d32' : '#54251f';
  }

  private async commitPendingMovieDeletion(): Promise<boolean> {
    const pending = this.pendingMovieDeletion();
    if (!pending) return true;

    this.clearPendingMovieDeleteTimer();
    this.pendingMovieDeletion.set(null);
    try {
      await this.api.deleteMovie(pending.movie.id);
      await this.reloadMovies();
      return true;
    } catch (error) {
      const message = this.errorMessage(error, 'Could not remove the movie. Please try again.');
      await this.reloadMovies();
      this.error.set(message);
      return false;
    }
  }

  private clearPendingMovieDeleteTimer(): void {
    if (this.pendingMovieDeleteTimer) clearTimeout(this.pendingMovieDeleteTimer);
    this.pendingMovieDeleteTimer = null;
  }

  private async reloadMovies(): Promise<void> {
    await this.loadMovies(true);
  }

  private restoreCollectionView(email: string): void {
    try {
      const stored = sessionStorage.getItem(this.collectionViewStorageKey(email));
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== 'object' || parsed === null) return;
      const state = parsed as Record<string, unknown>;

      if (typeof state['query'] === 'string') this.query.set(state['query'].slice(0, 100));
      if (isMovieSort(state['sortBy'])) this.sortBy.set(state['sortBy']);
      if (Array.isArray(state['selectedRatings'])) {
        const ratings = state['selectedRatings'].filter((value): value is number =>
          typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10);
        this.selectedRatings.set([...new Set(ratings)].sort((a, b) => b - a));
      }
      if (typeof state['includeUnrated'] === 'boolean') this.includeUnrated.set(state['includeUnrated']);
      if (state['activeTab'] === 'movies' || state['activeTab'] === 'watchlist') {
        this.activeTab.set(state['activeTab']);
        this.updateDocumentTitle();
      }
    } catch {
      // Session storage is optional; use the default view if it is unavailable or invalid.
    }
  }

  private persistCollectionView(): void {
    const email = this.user()?.email;
    if (!email) return;
    const state: CollectionViewState = {
      query: this.query(),
      sortBy: this.sortBy(),
      selectedRatings: this.selectedRatings(),
      includeUnrated: this.includeUnrated(),
      activeTab: this.activeTab(),
    };
    try {
      sessionStorage.setItem(this.collectionViewStorageKey(email), JSON.stringify(state));
    } catch {
      // Keep the current view in memory if session storage is unavailable.
    }
  }

  private collectionViewStorageKey(email: string): string {
    return `josephs-movies-view:${encodeURIComponent(email.trim().toLowerCase())}`;
  }

  private csvField(value: string | number | null): string {
    if (value === null) return '';
    const text = String(value);
    const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }

  private async loadMovies(reset: boolean): Promise<void> {
    const requestId = ++this.requestId;
    const requestedPage = reset ? 0 : this.page() + 1;
    if (reset) {
      this.loadingMovies.set(true);
      this.loadingMore.set(false);
      if (this.movies().length === 0) {
        this.totalItems.set(0);
        this.hasNext.set(false);
      }
    } else {
      this.loadingMore.set(true);
    }
    this.error.set('');

    const query: CatalogQuery = {
      page: requestedPage,
      size: this.pageSize,
      title: this.query(),
      ratings: this.selectedRatings(),
      includeUnrated: this.includeUnrated(),
      sort: this.sortBy(),
    };

    try {
      const result = await this.api.listMovies(query);
      if (requestId !== this.requestId) return;
      this.movies.update(current => reset ? result.items : [...current, ...result.items]);
      this.totalItems.set(result.totalItems);
      this.page.set(result.page);
      this.hasNext.set(result.hasNext);
    } catch (error) {
      if (requestId === this.requestId) this.error.set(this.errorMessage(error, 'Could not load your movies. Please try again.'));
    } finally {
      if (requestId === this.requestId) {
        this.loadingMovies.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private async loadWatchlist(): Promise<void> {
    const requestId = ++this.watchlistRequestId;
    this.watchlistLoading.set(true);
    this.error.set('');
    try {
      const items = await this.api.listWatchlist();
      if (requestId === this.watchlistRequestId) this.watchlist.set(items);
    } catch (error) {
      if (requestId === this.watchlistRequestId) {
        this.error.set(this.errorMessage(error, 'Could not load your watchlist. Please try again.'));
      }
    } finally {
      if (requestId === this.watchlistRequestId) this.watchlistLoading.set(false);
    }
  }

  private updateDocumentTitle(): void {
    const page = this.activeTab() === 'watchlist' ? 'Watchlist' : 'Collection';
    this.documentTitle.setTitle(`${page} | Joseph’s Movies`);
  }

  private handleSessionError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.user.set(null);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.error.set('This account is not authorized to use this movie collection. Sign out and choose an approved account.');
      return;
    }
    this.error.set('Could not reach the movie service. Check that the backend is running, then retry.');
  }

  private errorMessage(error: unknown, fallback: string, badRequestMessage = fallback): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) {
      this.user.set(null);
      return 'Your session expired. Sign in again to continue.';
    }
    if (error.status === 400) return badRequestMessage;
    if (error.status === 409) return 'That title is already in your collection or watchlist.';
    if (error.status === 403) return 'This action was denied. Reload the page and try again.';
    return fallback;
  }

  private readThemePreference(): Theme {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedTheme = localStorage.getItem('josephs-movies-theme');
        if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
      }
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch {
      // Fallback if environment lacks window or localStorage
    }
    return 'light';
  }

  private loginFailureMessage(): string {
    const failure = new URLSearchParams(window.location.search).get('authError');
    if (failure === 'access_denied') return 'This Google account is not authorized to use the movie collection.';
    if (failure === 'sign_in_failed') return 'Google sign-in failed. Please try again.';
    return '';
  }
}
