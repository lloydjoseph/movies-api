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
