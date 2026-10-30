import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface Movie {
  id: number;
  name: string;
  releaseYear: number;
  rating: number | null;
}

export interface MovieInput {
  name: string;
  releaseYear: number;
  rating: number | null;
}

export interface MoviePage {
  items: Movie[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

export type MovieSort =
  | 'rating_desc'
  | 'rating_asc'
  | 'year_desc'
  | 'year_asc'
  | 'title_asc'
  | 'title_desc';

export interface CatalogQuery {
  page: number;
  size: number;
  title: string;
  sort: MovieSort;
  ratings?: number[];
  includeUnrated?: boolean;
  ratingMode?: 'all' | 'unrated' | 'exact' | 'range';
  rating?: number;
  minRating?: number;
  maxRating?: number;
}

export interface SignedInUser {
  email: string;
  name: string;
}

interface CsrfToken {
  token: string;
  headerName: string;
}

@Injectable({ providedIn: 'root' })
export class MovieApiService {
  private readonly http = inject(HttpClient);

  currentUser(): Promise<SignedInUser> {
    return firstValueFrom(this.http.get<SignedInUser>('/api/auth/me'));
  }

  listMovies(query: CatalogQuery): Promise<MoviePage> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', query.sort);

    const title = query.title.trim();
    if (title.length >= 3) params = params.set('q', title);

    if (query.ratings && query.ratings.length > 0) {
      params = params.set('ratings', query.ratings.join(','));
    }
    if (query.includeUnrated) {
      params = params.set('includeUnrated', 'true');
    }
    if (query.ratingMode && !query.ratings?.length && !query.includeUnrated) {
      params = params.set('ratingMode', query.ratingMode);
      if (query.ratingMode === 'exact' && query.rating !== undefined) {
        params = params.set('rating', query.rating);
      }
      if (query.ratingMode === 'range' && query.minRating !== undefined && query.maxRating !== undefined) {
        params = params.set('minRating', query.minRating).set('maxRating', query.maxRating);
      }
    }
    return firstValueFrom(this.http.get<MoviePage>('/api/movies', { params }));
  }

  async createMovie(movie: MovieInput): Promise<Movie> {
    const csrf = await this.csrf();
    return firstValueFrom(this.http.post<Movie>('/api/movies', movie, {
      headers: { [csrf.headerName]: csrf.token },
    }));
  }

  async updateMovie(id: number, movie: MovieInput): Promise<Movie> {
    const csrf = await this.csrf();
    return firstValueFrom(this.http.put<Movie>(`/api/movies/${id}`, movie, {
      headers: { [csrf.headerName]: csrf.token },
    }));
  }

  async deleteMovie(id: number): Promise<void> {
    const csrf = await this.csrf();
    await firstValueFrom(this.http.delete<void>(`/api/movies/${id}`, {
      headers: { [csrf.headerName]: csrf.token },
    }));
  }

  async logout(): Promise<void> {
    const csrf = await this.csrf();
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {}, {
      headers: { [csrf.headerName]: csrf.token },
    }));
  }

  private csrf(): Promise<CsrfToken> {
    return firstValueFrom(this.http.get<CsrfToken>('/api/auth/csrf'));
  }
}
