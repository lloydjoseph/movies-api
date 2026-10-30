import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogQuery, Movie, MovieApiService, MovieInput, SignedInUser } from './movie-api.service';

type Theme = 'light' | 'dark';
type RatingFilter = 'all' | 'unrated' | 'exact' | 'range';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
})
export class App {
  private readonly api = inject(MovieApiService);

  readonly user = signal<SignedInUser | null>(null);
  readonly movies = signal<Movie[]>([]);
  readonly loading = signal(true);
  readonly loadingMovies = signal(false);
  readonly loadingMore = signal(false);
  readonly totalItems = signal(0);
  readonly hasNext = signal(false);
  readonly page = signal(0);
  readonly saving = signal(false);
  readonly error = signal(this.loginFailureMessage());
  readonly query = signal('');
  readonly ratingFilter = signal<RatingFilter>('all');
  readonly exactRating = signal(8);
  readonly rangeStart = signal(1);
  readonly rangeEnd = signal(10);
  readonly editorOpen = signal(false);
  readonly editingMovie = signal<Movie | null>(null);
  readonly deletingMovie = signal<Movie | null>(null);
  readonly theme = signal<Theme>(this.readThemePreference());

  title = '';
  releaseYear: number | null = new Date().getFullYear();
  rating: number | null = null;

  readonly visibleMovies = computed(() => this.movies());

  private readonly pageSize = 50;
  private requestId = 0;
  private queryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.loadSession();
  }

  async loadSession(): Promise<void> {
    this.loading.set(true);
    this.error.set(this.loginFailureMessage());

    try {
      this.user.set(await this.api.currentUser());
      await this.loadMovies(true);
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
      await this.api.logout();
      this.user.set(null);
      this.movies.set([]);
      this.totalItems.set(0);
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not sign out. Please try again.'));
    }
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    localStorage.setItem('josephs-movies-theme', nextTheme);
  }

  openCreateForm(): void {
    this.editingMovie.set(null);
    this.title = '';
    this.releaseYear = new Date().getFullYear();
    this.rating = null;
    this.editorOpen.set(true);
  }

  openEditForm(movie: Movie): void {
    this.editingMovie.set(movie);
    this.title = movie.name;
    this.releaseYear = movie.releaseYear;
    this.rating = movie.rating;
    this.editorOpen.set(true);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    if (this.queryTimer !== null) clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => void this.loadMovies(true), 250);
  }

  onRatingModeChange(value: string): void {
    this.ratingFilter.set(value as RatingFilter);
    void this.loadMovies(true);
  }

  onExactRatingChange(value: number): void {
    this.exactRating.set(Number(value));
    void this.loadMovies(true);
  }

  onRangeStartChange(value: number): void {
    const start = Number(value);
    this.rangeStart.set(start);
    if (start > this.rangeEnd()) this.rangeEnd.set(start);
    void this.loadMovies(true);
  }

  onRangeEndChange(value: number): void {
    const end = Number(value);
    this.rangeEnd.set(end);
    if (end < this.rangeStart()) this.rangeStart.set(end);
    void this.loadMovies(true);
  }

  loadMore(): void {
    if (this.hasNext() && !this.loadingMore()) void this.loadMovies(false);
  }

  closeEditor(): void {
    if (!this.saving()) this.editorOpen.set(false);
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
      else await this.api.createMovie(movie);

      this.editorOpen.set(false);
      await this.reloadMovies();
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not save the movie. Check the details and try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const movie = this.deletingMovie();
    if (!movie) return;

    this.error.set('');
    try {
      await this.api.deleteMovie(movie.id);
      this.deletingMovie.set(null);
      await this.reloadMovies();
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not remove the movie. Please try again.'));
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

  private async reloadMovies(): Promise<void> {
    await this.loadMovies(true);
  }

  private async loadMovies(reset: boolean): Promise<void> {
    const requestId = ++this.requestId;
    const requestedPage = reset ? 0 : this.page() + 1;
    if (reset) {
      this.loadingMovies.set(true);
      this.loadingMore.set(false);
      this.movies.set([]);
      this.totalItems.set(0);
      this.hasNext.set(false);
    } else {
      this.loadingMore.set(true);
    }
    this.error.set('');

    const query: CatalogQuery = {
      page: requestedPage,
      size: this.pageSize,
      title: this.query(),
      ratingMode: this.ratingFilter(),
      rating: this.exactRating(),
      minRating: this.rangeStart(),
      maxRating: this.rangeEnd(),
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

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) {
      this.user.set(null);
      return 'Your session expired. Sign in again to continue.';
    }
    if (error.status === 400) return 'The movie details were rejected. Check the title, year, and rating.';
    if (error.status === 403) return 'This action was denied. Reload the page and try again.';
    return fallback;
  }

  private readThemePreference(): Theme {
    const savedTheme = localStorage.getItem('josephs-movies-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private loginFailureMessage(): string {
    const failure = new URLSearchParams(window.location.search).get('authError');
    if (failure === 'access_denied') return 'This Google account is not authorized to use the movie collection.';
    if (failure === 'sign_in_failed') return 'Google sign-in failed. Please try again.';
    return '';
  }
}
