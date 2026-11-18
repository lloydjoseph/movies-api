import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { MovieApiService } from '../movie-api.service';
import type { MovieLookupResult } from '../movie-api.service';

@Component({
  selector: 'app-movie-lookup',
  templateUrl: './movie-lookup.html',
})
export class MovieLookupComponent implements OnChanges, OnDestroy {
  @Input() searchTerm = '';
  @Output() readonly movieSelected = new EventEmitter<MovieLookupResult>();
  @Output() readonly sessionExpired = new EventEmitter<void>();
  @Output() readonly resultsVisible = new EventEmitter<boolean>();

  private readonly api = inject(MovieApiService);

  readonly results = signal<MovieLookupResult[]>([]);
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly error = signal('');

  private requestId = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private skipSearchForTitle: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['searchTerm']) return;

    if (this.skipSearchForTitle === this.searchTerm) {
      this.skipSearchForTitle = null;
      this.cancelSearch();
      return;
    }

    this.skipSearchForTitle = null;
    this.scheduleSearch(this.searchTerm);
  }

  ngOnDestroy(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.requestId++;
  }

  selectMovie(movie: MovieLookupResult): void {
    this.skipSearchForTitle = movie.title;
    this.cancelSearch();
    this.movieSelected.emit(movie);
  }

  private scheduleSearch(value: string): void {
    this.results.set([]);
    this.resultsVisible.emit(false);
    this.searched.set(false);
    this.error.set('');
    this.loading.set(false);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);

    const query = value.trim().slice(0, 100);
    const requestId = ++this.requestId;
    if (query.length < 2) return;

    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.search(query, requestId);
    }, 350);
  }

  private cancelSearch(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.requestId++;
    this.results.set([]);
    this.resultsVisible.emit(false);
    this.loading.set(false);
    this.searched.set(false);
    this.error.set('');
  }

  private async search(query: string, requestId: number): Promise<void> {
    this.loading.set(true);
    try {
      const results = await this.api.lookupMovies(query);
      if (requestId !== this.requestId) return;
      this.results.set(results);
      this.resultsVisible.emit(results.length > 0);
      this.searched.set(true);
    } catch (error) {
      if (requestId !== this.requestId) return;
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.sessionExpired.emit();
      } else {
        this.error.set('TMDb lookup is unavailable. You can still enter the movie details manually.');
      }
    } finally {
      if (requestId === this.requestId) this.loading.set(false);
    }
  }
}
