import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MovieApiService } from '../movie-api.service';
import type { WatchlistItem } from '../movie-api.service';
import { WatchlistComponent } from './watchlist';

describe('WatchlistComponent', () => {
  const initialItem: WatchlistItem = {
    id: 7,
    name: 'There Will Be Blood',
    releaseYear: 2007,
    notes: 'Recommended by Alex',
    priority: 'MEDIUM',
  };
  let api: {
    listWatchlist: ReturnType<typeof vi.fn>;
    addWatchlistItem: ReturnType<typeof vi.fn>;
    updateWatchlistItem: ReturnType<typeof vi.fn>;
    deleteWatchlistItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      listWatchlist: vi.fn(() => Promise.resolve([initialItem])),
      addWatchlistItem: vi.fn((name: string, releaseYear: number, notes: string, priority: WatchlistItem['priority']) =>
        Promise.resolve({ id: 8, name, releaseYear, notes: notes || null, priority })),
      updateWatchlistItem: vi.fn((id: number, name: string, releaseYear: number, notes: string, priority: WatchlistItem['priority']) =>
        Promise.resolve({ id, name, releaseYear, notes: notes || null, priority })),
      deleteWatchlistItem: vi.fn(() => Promise.resolve()),
    };
    await TestBed.configureTestingModule({
      imports: [WatchlistComponent],
      providers: [{ provide: MovieApiService, useValue: api }],
    }).compileComponents();
  });

  it('loads titles and emits the selected item when marked seen', async () => {
    const fixture = TestBed.createComponent(WatchlistComponent);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    expect(rendered.textContent).toContain('Recommended by Alex');
    expect(rendered.querySelector('[aria-label="Priority: Medium"] svg[aria-hidden="true"]')).not.toBeNull();

    const seen = vi.fn();
    fixture.componentInstance.markSeen.subscribe(seen);
    Array.from(rendered.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.includes('Add to collection'))
      ?.click();
    expect(seen).toHaveBeenCalledWith(initialItem);
  });

  it('adds and edits a title with notes and priority', async () => {
    const fixture = TestBed.createComponent(WatchlistComponent);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.openAddForm();
    component.title = 'Moonlight';
    component.releaseYear = 2016;
    component.notes = 'Watch again';
    component.priority = 'HIGH';
    await component.saveNewItem();
    fixture.detectChanges();

    expect(api.addWatchlistItem).toHaveBeenCalledWith('Moonlight', 2016, 'Watch again', 'HIGH');
    expect(component.items().map(item => item.name)).toEqual(['Moonlight', 'There Will Be Blood']);

    component.openEdit(component.items()[0]);
    component.editingReleaseYear = 2017;
    component.editingNotes = 'Watch on a big screen';
    component.editingPriority = 'LOW';
    await component.saveEdit(component.items()[0]);
    fixture.detectChanges();

    expect(api.updateWatchlistItem).toHaveBeenCalledWith(8, 'Moonlight', 2017, 'Watch on a big screen', 'LOW');
    expect(component.items()[0].notes).toBe('Watch on a big screen');
    expect(component.items()[0].priority).toBe('LOW');
  });

  it('confirms before removing an item', async () => {
    const fixture = TestBed.createComponent(WatchlistComponent);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Edit There Will Be Blood"]')?.click();
    fixture.detectChanges();
    rendered.querySelector<HTMLButtonElement>('button[aria-label="Remove There Will Be Blood from watchlist"]')?.click();
    fixture.detectChanges();

    const confirmation = rendered.querySelector<HTMLElement>('[aria-labelledby="watchlist-delete-heading-7"]');
    expect(confirmation?.closest('dialog')?.open).toBe(true);
    expect(api.deleteWatchlistItem).not.toHaveBeenCalled();

    confirmation?.querySelectorAll<HTMLButtonElement>('button')[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.deleteWatchlistItem).toHaveBeenCalledWith(7);
    expect(fixture.componentInstance.items()).toEqual([]);
  });

  it('prevents duplicate removal requests while one is in flight', async () => {
    let resolveRemoval!: () => void;
    api.deleteWatchlistItem.mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveRemoval = resolve;
    }));
    const fixture = TestBed.createComponent(WatchlistComponent);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.requestRemove(initialItem);
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-labelledby="watchlist-delete-heading-7"] button:last-child');
    const removal = component.confirmRemove(initialItem);
    fixture.detectChanges();
    await component.confirmRemove(initialItem);

    expect(api.deleteWatchlistItem).toHaveBeenCalledOnce();
    expect(button?.disabled).toBe(true);

    resolveRemoval();
    await removal;
    expect(component.items()).toEqual([]);
    fixture.destroy();
  });

  it('reports duplicate-title conflicts in the feature', async () => {
    api.addWatchlistItem.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));
    const fixture = TestBed.createComponent(WatchlistComponent);
    const component = fixture.componentInstance;
    component.title = 'Arrival';
    component.releaseYear = 2016;
    await component.saveNewItem();

    expect(component.error()).toBe('That title is already in your collection or watchlist.');
  });
});
