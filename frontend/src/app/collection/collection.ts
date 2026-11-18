import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideArrowUpDown,
  LucideDownload,
  LucidePencil,
  LucidePlus,
  LucideSearch,
} from '@lucide/angular';
import { MovieApiService } from '../movie-api.service';
import type { CatalogQuery, Movie, MovieSort } from '../movie-api.service';
import { ratingColor, ratingTextColor } from '../movie-presentation';
import type { CollectionView, MovieDeletionRequest, SaveConfirmation } from './collection.models';

type SortDirection = 'ascending' | 'descending' | 'unsorted';
type PendingMovieDeletion = {
  movie: Movie;
  index: number;
};

const pageSize = 50;

@Component({
  selector: 'app-collection',
  imports: [
    FormsModule,
    LucideArrowDown,
    LucideArrowUp,
    LucideArrowUpDown,
    LucideDownload,
    LucidePencil,
    LucidePlus,
    LucideSearch,
  ],
  templateUrl: './collection.html',
})
export class CollectionComponent implements OnChanges, OnDestroy {
  @Input() active = false;
  @Input() reloadRequest = 0;
  @Input() view: CollectionView = {
    query: '',
    sortBy: 'rating_desc',
    selectedRatings: [],
    includeUnrated: false,
  };
  @Input() deleteRequest: MovieDeletionRequest | null = null;
  @Input() saveConfirmation: SaveConfirmation | null = null;
  @Input() saveConfirmationFading = false;
  @Output() readonly viewChange = new EventEmitter<CollectionView>();
  @Output() readonly createMovie = new EventEmitter<void>();
  @Output() readonly editMovie = new EventEmitter<Movie>();
  @Output() readonly deleteConfirmed = new EventEmitter<Movie>();
  @Output() readonly sessionExpired = new EventEmitter<void>();

  private readonly api = inject(MovieApiService);

  readonly movies = signal<Movie[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly exporting = signal(false);
  readonly totalItems = signal(0);
  readonly hasNext = signal(false);
  readonly page = signal(0);
  readonly error = signal('');
  readonly query = signal('');
  readonly sortBy = signal<MovieSort>('rating_desc');
  readonly selectedRatings = signal<number[]>([]);
  readonly includeUnrated = signal(false);
  readonly deletingMovie = signal<Movie | null>(null);
  readonly pendingMovieDeletion = signal<PendingMovieDeletion | null>(null);

  @ViewChild('confirmationDialog') private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private requestId = 0;
  private readonly movieDeletionCommits = new Set<Promise<boolean>>();
  private queryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMovieDeleteTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['view']) {
      this.query.set(this.view.query);
      this.sortBy.set(this.view.sortBy);
      this.selectedRatings.set(this.view.selectedRatings);
      this.includeUnrated.set(this.view.includeUnrated);
    }
    if (this.active && (changes['active'] || changes['reloadRequest'])) {
      void this.loadMovies(true);
    }
    if (changes['deleteRequest'] && this.deleteRequest) {
      this.requestDelete(this.deleteRequest.movie);
    }
  }

  ngOnDestroy(): void {
    if (this.queryTimer !== null) clearTimeout(this.queryTimer);
    if (this.pendingMovieDeletion()) {
      void this.commitPendingMovieDeletion();
    } else {
      this.clearPendingMovieDeleteTimer();
    }
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.publishView();
    if (this.queryTimer !== null) clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => {
      this.queryTimer = null;
      void this.loadMovies(true);
    }, 250);
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
    this.publishView();
    void this.loadMovies(true);
  }

  toggleRating(score: number): void {
    const current = this.selectedRatings();
    if (current.includes(score)) {
      this.selectedRatings.set(current.filter(value => value !== score));
    } else {
      this.selectedRatings.set([...current, score].sort((a, b) => b - a));
    }
    this.publishView();
    void this.loadMovies(true);
  }

  toggleUnrated(): void {
    this.includeUnrated.update(value => !value);
    this.publishView();
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
    if (current === 'title_asc') return 'ascending';
    if (current === 'title_desc') return 'descending';
    return 'unsorted';
  }

  toggleSort(field: 'rating' | 'year' | 'title'): void {
    const current = this.sortBy();
    if (field === 'rating') {
      this.setSort(current === 'rating_desc' ? 'rating_asc' : current === 'rating_asc' ? 'none' : 'rating_desc');
    } else if (field === 'year') {
      this.setSort(current === 'year_desc' ? 'year_asc' : current === 'year_asc' ? 'none' : 'year_desc');
    } else {
      this.setSort(current === 'title_asc' ? 'title_desc' : current === 'title_desc' ? 'none' : 'title_asc');
    }
  }

  private setSort(sort: MovieSort): void {
    this.sortBy.set(sort);
    this.publishView();
    void this.loadMovies(true);
  }

  loadMore(): void {
    if (this.hasNext() && !this.loadingMore()) void this.loadMovies(false);
  }

  retry(): void {
    void this.loadMovies(true);
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

  requestDelete(movie: Movie): void {
    if (this.pendingMovieDeletion()) return;
    this.error.set('');
    this.deletingMovie.set(movie);
    this.showDialog(this.confirmationDialog?.nativeElement);
  }

  cancelDelete(): void {
    this.deletingMovie.set(null);
    this.hideDialog(this.confirmationDialog?.nativeElement);
  }

  confirmDelete(): void {
    const movie = this.deletingMovie();
    if (!movie || this.pendingMovieDeletion()) return;

    this.error.set('');
    const index = this.movies().findIndex(current => current.id === movie.id);
    this.cancelDelete();
    if (index >= 0) {
      this.movies.update(current => current.filter(item => item.id !== movie.id));
      this.totalItems.update(count => Math.max(0, count - 1));
    }
    this.pendingMovieDeletion.set({ movie, index });
    this.deleteConfirmed.emit(movie);
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
    await this.loadMovies(true);
  }

  async flushPendingDeletion(): Promise<boolean> {
    return this.commitPendingMovieDeletion();
  }

  ratingColor(value: number | null): string {
    return ratingColor(value);
  }

  ratingTextColor(value: number | null): string {
    return ratingTextColor(value);
  }

  onConfirmationDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelDelete();
  }

  onConfirmationDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelDelete();
  }

  private publishView(): void {
    this.viewChange.emit({
      query: this.query(),
      sortBy: this.sortBy(),
      selectedRatings: this.selectedRatings(),
      includeUnrated: this.includeUnrated(),
    });
  }

  private async loadMovies(reset: boolean): Promise<void> {
    const requestId = ++this.requestId;
    const requestedPage = reset ? 0 : this.page() + 1;
    if (reset) {
      this.loading.set(true);
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
      size: pageSize,
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
      if (requestId === this.requestId) {
        this.error.set(this.errorMessage(error, 'Could not load your movies. Please try again.'));
      }
    } finally {
      if (requestId === this.requestId) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private async commitPendingMovieDeletion(): Promise<boolean> {
    const pending = this.pendingMovieDeletion();
    if (pending) {
      this.clearPendingMovieDeleteTimer();
      this.pendingMovieDeletion.set(null);
      const commit = this.performMovieDeletion(pending);
      this.movieDeletionCommits.add(commit);
      void commit.then(
        () => this.movieDeletionCommits.delete(commit),
        () => this.movieDeletionCommits.delete(commit),
      );
    }

    const commits = [...this.movieDeletionCommits];
    const results = await Promise.all(commits);
    return results.every(Boolean);
  }

  private async performMovieDeletion(pending: PendingMovieDeletion): Promise<boolean> {
    try {
      await this.api.deleteMovie(pending.movie.id);
      await this.loadMovies(true);
      return true;
    } catch (error) {
      const message = this.errorMessage(error, 'Could not remove the movie. Please try again.');
      await this.loadMovies(true);
      this.error.set(message);
      return false;
    }
  }

  private clearPendingMovieDeleteTimer(): void {
    if (this.pendingMovieDeleteTimer !== null) clearTimeout(this.pendingMovieDeleteTimer);
    this.pendingMovieDeleteTimer = null;
  }

  private csvField(value: string | number | null): string {
    if (value === null) return '';
    const text = String(value);
    const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) {
      this.sessionExpired.emit();
      return 'Your session expired. Sign in again to continue.';
    }
    if (error.status === 409) return 'That title is already in your collection or watchlist.';
    if (error.status === 403) return 'This action was denied. Reload the page and try again.';
    return fallback;
  }

  private showDialog(dialog: HTMLDialogElement | undefined): void {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  private hideDialog(dialog: HTMLDialogElement | undefined): void {
    if (!dialog?.open) return;
    if (typeof dialog.showModal === 'function' && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
}
