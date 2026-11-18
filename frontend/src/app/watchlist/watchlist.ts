import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp, LucideMinus, LucidePencil, LucidePlus } from '@lucide/angular';
import { MovieApiService, WatchlistItem, WatchlistPriority } from '../movie-api.service';
import { MovieLookupComponent } from '../movie-lookup/movie-lookup';
import type { MovieLookupResult } from '../movie-api.service';

@Component({
  selector: 'app-watchlist',
  imports: [FormsModule, LucideArrowDown, LucideArrowUp, LucideMinus, LucidePencil, LucidePlus, MovieLookupComponent],
  templateUrl: './watchlist.html',
})
export class WatchlistComponent implements OnChanges {
  @Input() active = false;
  @Input() reloadRequest = 0;
  @Input() convertedItemId: number | null = null;
  @Output() readonly markSeen = new EventEmitter<WatchlistItem>();
  @Output() readonly sessionExpired = new EventEmitter<void>();

  private readonly api = inject(MovieApiService);

  readonly items = signal<WatchlistItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly removingItemId = signal<number | null>(null);
  readonly error = signal('');
  readonly addEditorOpen = signal(false);
  readonly editingItemId = signal<number | null>(null);
  readonly deletingItemId = signal<number | null>(null);
  readonly editingItem = computed(() =>
    this.items().find(item => item.id === this.editingItemId()) ?? null);
  readonly deletingItem = computed(() =>
    this.items().find(item => item.id === this.deletingItemId()) ?? null);

  title = '';
  releaseYear: number | null = null;
  editingReleaseYear: number | null = null;
  lookupResultsVisible = false;
  notes = '';
  priority: WatchlistPriority = 'MEDIUM';
  editingTitle = '';
  editingNotes = '';
  editingPriority: WatchlistPriority = 'MEDIUM';

  @ViewChild('editorDialog') private editorDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('confirmationDialog') private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.active && (changes['active'] || changes['reloadRequest'])) {
      void this.load();
    }
    if (changes['convertedItemId'] && this.convertedItemId !== null) {
      this.items.update(items => items.filter(item => item.id !== this.convertedItemId));
    }
  }

  async load(): Promise<void> {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const items = await this.api.listWatchlist();
      if (requestId === this.requestId) this.items.set(items);
    } catch (error) {
      if (requestId === this.requestId) {
        this.error.set(this.errorMessage(error, 'Could not load your watchlist. Please try again.'));
      }
    } finally {
      if (requestId === this.requestId) this.loading.set(false);
    }
  }

  openAddForm(): void {
    this.error.set('');
    this.title = '';
    this.releaseYear = null;
    this.lookupResultsVisible = false;
    this.notes = '';
    this.priority = 'MEDIUM';
    this.editingItemId.set(null);
    this.addEditorOpen.set(true);
    this.showDialog(this.editorDialog?.nativeElement);
  }

  onMovieLookupSelected(movie: MovieLookupResult): void {
    this.title = movie.title;
    this.releaseYear = movie.releaseYear;
    this.lookupResultsVisible = false;
  }

  async saveNewItem(): Promise<void> {
    const name = this.title.trim();
    if (!name || this.releaseYear === null || this.saving() || !this.isValidReleaseYear(this.releaseYear)) return;

    this.saving.set(true);
    this.error.set('');
    try {
      const item = await this.api.addWatchlistItem(name, this.releaseYear, this.notes.trim(), this.priority);
      this.items.update(items => [...items, item].sort((a, b) => a.name.localeCompare(b.name)));
      this.dismissEditor();
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not add the title to your watchlist. Please try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  openEdit(item: WatchlistItem): void {
    this.error.set('');
    this.addEditorOpen.set(false);
    this.editingItemId.set(item.id);
    this.editingTitle = item.name;
    this.editingReleaseYear = item.releaseYear ?? null;
    this.editingNotes = item.notes ?? '';
    this.editingPriority = item.priority;
    this.showDialog(this.editorDialog?.nativeElement);
  }

  cancelEdit(): void {
    if (this.saving()) return;
    this.dismissEditor();
  }

  closeAddForm(): void {
    if (this.saving()) return;
    this.dismissEditor();
  }

  async saveEdit(item: WatchlistItem): Promise<void> {
    const name = this.editingTitle.trim();
    if (!name || this.editingReleaseYear === null || this.saving() || !this.isValidReleaseYear(this.editingReleaseYear)) return;

    this.saving.set(true);
    this.error.set('');
    try {
      const updated = await this.api.updateWatchlistItem(
        item.id, name, this.editingReleaseYear, this.editingNotes.trim(), this.editingPriority);
      this.items.update(items => items
        .map(current => current.id === item.id ? updated : current)
        .sort((a, b) => a.name.localeCompare(b.name)));
      this.dismissEditor();
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not update the watchlist item. Please try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  requestRemove(item: WatchlistItem): void {
    this.error.set('');
    this.dismissEditor();
    this.deletingItemId.set(item.id);
    this.showDialog(this.confirmationDialog?.nativeElement);
  }

  cancelRemove(): void {
    this.deletingItemId.set(null);
    this.hideDialog(this.confirmationDialog?.nativeElement);
  }

  async confirmRemove(item: WatchlistItem): Promise<void> {
    if (this.removingItemId() !== null) return;

    this.removingItemId.set(item.id);
    this.error.set('');
    try {
      await this.api.deleteWatchlistItem(item.id);
      this.items.update(items => items.filter(current => current.id !== item.id));
      this.deletingItemId.set(null);
      this.hideDialog(this.confirmationDialog?.nativeElement);
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Could not remove the title from your watchlist. Please try again.'));
    } finally {
      this.removingItemId.set(null);
    }
  }

  markItemSeen(item: WatchlistItem): void {
    this.error.set('');
    this.markSeen.emit(item);
  }

  priorityLabel(priority: WatchlistPriority): string {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  }

  isValidReleaseYear(year: number | null): boolean {
    return year !== null && Number.isInteger(year) && year >= 1 && year <= 9999;
  }

  onEditorDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.addEditorOpen()) this.closeAddForm();
    else if (this.editingItemId() !== null) this.cancelEdit();
  }

  onEditorDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    if (this.addEditorOpen()) this.closeAddForm();
    else if (this.editingItemId() !== null) this.cancelEdit();
  }

  onConfirmationDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelRemove();
  }

  onConfirmationDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelRemove();
  }

  private dismissEditor(): void {
    this.addEditorOpen.set(false);
    this.editingItemId.set(null);
    this.title = '';
    this.releaseYear = null;
    this.notes = '';
    this.priority = 'MEDIUM';
    this.editingTitle = '';
    this.editingReleaseYear = null;
    this.editingNotes = '';
    this.editingPriority = 'MEDIUM';
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
}
