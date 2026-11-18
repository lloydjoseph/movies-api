import type { Movie, MovieSort } from '../movie-api.service';

export interface CollectionView {
  query: string;
  sortBy: MovieSort;
  selectedRatings: number[];
  includeUnrated: boolean;
}

export interface MovieDeletionRequest {
  movie: Movie;
  sequence: number;
}

export interface SaveConfirmation {
  action: 'created' | 'updated';
  name: string;
  releaseYear: number;
  rating: number | null;
}
