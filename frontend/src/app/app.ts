import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import {
  LucideCircleUserRound,
  LucideMoon,
  LucideSun,
} from '@lucide/angular';
import { MovieApiService } from './movie-api.service';
import type { Movie, MovieInput, SignedInUser, WatchlistItem } from './movie-api.service';
import { CollectionComponent } from './collection/collection';
import type { CollectionView, MovieDeletionRequest } from './collection/collection.models';
import { ratingColor, ratingTextColor } from './movie-presentation';
import { WatchlistComponent } from './watchlist/watchlist';

type Theme = 'light' | 'dark';
type CollectionViewState = CollectionView & {
  activeTab: 'movies' | 'watchlist';
};
type SaveConfirmation = {
  action: 'created' | 'updated';
  name: string;
  releaseYear: number;
  rating: number | null;
};

function isMovieSort(value: unknown): value is CollectionView['sortBy'] {
  return value === 'rating_desc' || value === 'rating_asc'
    || value === 'year_desc' || value === 'year_asc'
    || value === 'title_asc' || value === 'title_desc' || value === 'none';
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, LucideCircleUserRound, LucideMoon, LucideSun, CollectionComponent, WatchlistComponent],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private readonly api = inject(MovieApiService);
  private readonly documentTitle = inject(Title);

  readonly user = signal<SignedInUser | null>(null);
  readonly activeTab = signal<'movies' | 'watchlist'>('movies');
  readonly collectionView = signal<CollectionView>({
    query: '',
    sortBy: 'rating_desc',
    selectedRatings: [],
    includeUnrated: false,
  });
  readonly collectionReloadRequest = signal(0);
  readonly movieDeletionRequest = signal<MovieDeletionRequest | null>(null);
  readonly watchlistReloadRequest = signal(0);
  readonly convertedWatchlistItemId = signal<number | null>(null);
  readonly pendingWatchlistItemId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal(this.loginFailureMessage());
  readonly editorOpen = signal(false);
  readonly editingMovie = signal<Movie | null>(null);
  readonly saveConfirmation = signal<SaveConfirmation | null>(null);
  readonly saveConfirmationFading = signal(false);
  readonly theme = signal<Theme>(this.readThemePreference());

  title = '';
  releaseYear: number | null = new Date().getFullYear();
  rating: number | null = null;

  @ViewChild('editorDialog') private editorDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild(CollectionComponent) private collectionComponent?: CollectionComponent;
  private movieDeletionSequence = 0;
  private saveConfirmationTimer: ReturnType<typeof setTimeout> | null = null;
  private saveConfirmationDismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.updateDocumentTitle();
    void this.loadSession();
  }

  ngOnDestroy(): void {
    this.clearSaveConfirmationTimers();
  }

  async loadSession(): Promise<void> {
    this.loading.set(true);
    this.error.set(this.loginFailureMessage());

    try {
      const user = await this.api.currentUser();
      this.user.set(user);
      this.restoreCollectionView(user.email);
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
      if (this.collectionComponent && !await this.collectionComponent.flushPendingDeletion()) return;
      await this.api.logout();
      this.clearAuthenticatedState();
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

  openCreateForm(): void {
    this.error.set('');
    this.pendingWatchlistItemId.set(null);
    this.editingMovie.set(null);
    this.title = '';
    this.releaseYear = new Date().getFullYear();
    this.rating = null;
    this.editorOpen.set(true);
    this.showDialog(this.editorDialog?.nativeElement);
  }

  selectTab(tab: 'movies' | 'watchlist'): void {
    this.activeTab.set(tab);
    this.persistCollectionView();
    this.updateDocumentTitle();
    if (tab === 'watchlist') this.watchlistReloadRequest.update(request => request + 1);
  }

  onCollectionViewChange(view: CollectionView): void {
    this.collectionView.set(view);
    this.persistCollectionView();
  }

  markWatchlistItemSeen(item: WatchlistItem): void {
    this.error.set('');
    this.selectTab('movies');
    this.pendingWatchlistItemId.set(item.id);
    this.editingMovie.set(null);
    this.title = item.name;
    this.releaseYear = new Date().getFullYear();
    this.rating = null;
    this.editorOpen.set(true);
    this.showDialog(this.editorDialog?.nativeElement);
  }

  onSessionExpired(): void {
    this.error.set('Your session expired. Sign in again to continue.');
    this.clearAuthenticatedState();
  }

  openEditForm(movie: Movie): void {
    this.error.set('');
    this.editingMovie.set(movie);
    this.title = movie.name;
    this.releaseYear = movie.releaseYear;
    this.rating = movie.rating;
    this.editorOpen.set(true);
    this.showDialog(this.editorDialog?.nativeElement);
  }

  requestDelete(movie: Movie): void {
    this.error.set('');
    if (this.editingMovie()?.id !== movie.id || !this.editorOpen()) {
      this.editingMovie.set(null);
      this.editorOpen.set(false);
      this.hideDialog(this.editorDialog?.nativeElement);
    }
    this.movieDeletionRequest.set({ movie, sequence: ++this.movieDeletionSequence });
  }

  onMovieDeletionConfirmed(movie: Movie): void {
    if (this.editingMovie()?.id === movie.id) this.dismissMovieEditor();
  }

  closeEditor(): void {
    if (this.saving()) return;
    this.dismissMovieEditor();
  }

  onEditorDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.editorOpen()) this.closeEditor();
  }

  onEditorDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    if (this.editorOpen()) this.closeEditor();
  }

  private dismissMovieEditor(): void {
    this.editorOpen.set(false);
    this.editingMovie.set(null);
    this.pendingWatchlistItemId.set(null);
    this.hideDialog(this.editorDialog?.nativeElement);
  }

  private showDialog(dialog: HTMLDialogElement | undefined): void {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    queueMicrotask(() => {
      if (dialog.open) dialog.querySelector<HTMLElement>('[autofocus]')?.focus();
    });
  }

  private hideDialog(dialog: HTMLDialogElement | undefined): void {
    if (!dialog?.open) return;
    if (typeof dialog.showModal === 'function' && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
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

      this.dismissMovieEditor();
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
      this.collectionReloadRequest.update(request => request + 1);
      if (watchlistItemId !== null) {
        this.convertedWatchlistItemId.set(watchlistItemId);
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

  ratingColor(value: number | null): string {
    return ratingColor(value);
  }

  ratingTextColor(value: number | null): string {
    return ratingTextColor(value);
  }

  private restoreCollectionView(email: string): void {
    try {
      const stored = sessionStorage.getItem(this.collectionViewStorageKey(email));
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== 'object' || parsed === null) return;
      const state = parsed as Record<string, unknown>;

      const current = this.collectionView();
      const restored: CollectionView = {
        ...current,
        query: typeof state['query'] === 'string' ? state['query'].slice(0, 100) : current.query,
        sortBy: isMovieSort(state['sortBy']) ? state['sortBy'] : current.sortBy,
      };
      if (Array.isArray(state['selectedRatings'])) {
        const ratings = state['selectedRatings'].filter((value): value is number =>
          typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10);
        restored.selectedRatings = [...new Set(ratings)].sort((a, b) => b - a);
      }
      if (typeof state['includeUnrated'] === 'boolean') restored.includeUnrated = state['includeUnrated'];
      this.collectionView.set(restored);
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
      ...this.collectionView(),
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

  private updateDocumentTitle(): void {
    const page = this.activeTab() === 'watchlist' ? 'Watchlist' : 'Collection';
    this.documentTitle.setTitle(`${page} | Joseph’s Movies`);
  }

  private handleSessionError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.clearAuthenticatedState();
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
      this.clearAuthenticatedState();
      return 'Your session expired. Sign in again to continue.';
    }
    if (error.status === 400) return badRequestMessage;
    if (error.status === 409) return 'That title is already in your collection or watchlist.';
    if (error.status === 403) return 'This action was denied. Reload the page and try again.';
    return fallback;
  }

  private clearAuthenticatedState(): void {
    this.user.set(null);
    this.editorOpen.set(false);
    this.editingMovie.set(null);
    this.pendingWatchlistItemId.set(null);
    this.convertedWatchlistItemId.set(null);
    this.movieDeletionRequest.set(null);
    this.saveConfirmation.set(null);
    this.clearSaveConfirmationTimers();
    this.hideDialog(this.editorDialog?.nativeElement);
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
