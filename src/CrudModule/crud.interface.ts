import { Paginated, Requester } from 'src/share';

export interface PagingDTO {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Generic CRUD service interface
 */
export interface ICrudService<T, C, U> {
  getEntity(id: string): Promise<T>;
  findEntity(conditions: any): Promise<T | null>;
  listEntities(
    requester: Requester,
    conditions: any,
    pagination: PagingDTO,
  ): Promise<Paginated<T>>;
  createEntity(requester: Requester, dto: C): Promise<string>;
  updateEntity(requester: Requester, id: string, dto: U): Promise<void>;
  deleteEntity(requester: Requester, id: string): Promise<void>;
}

/**
 * Generic CRUD repository interface
 */
export interface ICrudRepository<T, C, U> {
  get(id: string): Promise<T | null>;
  findByCond(conditions: any): Promise<T | null>;
  list(conditions: any, pagination: PagingDTO): Promise<Paginated<T>>;
  insert(entity: any): Promise<string>;
  update(id: string, dto: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}
