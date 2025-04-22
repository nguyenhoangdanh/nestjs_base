import { Paginated, Requester } from '../../../share';

/**
 * Interface định nghĩa cấu trúc cho pagination và sorting
 */
export interface PagingDTO {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface cơ bản cho CRUD service
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 */
export interface ICrudService<T, C, U> {
  /**
   * Lấy entity theo ID
   */
  getEntity(id: string): Promise<T>;

  /**
   * Tìm entity theo điều kiện
   */
  findEntity(conditions: any): Promise<T | null>;

  /**
   * Lấy danh sách entity với phân trang
   */
  listEntities(
    requester: Requester,
    conditions: any,
    pagination: PagingDTO,
  ): Promise<Paginated<T>>;

  /**
   * Tạo mới entity
   */
  createEntity(requester: Requester, dto: C): Promise<string>;

  /**
   * Cập nhật entity
   */
  updateEntity(requester: Requester, id: string, dto: U): Promise<void>;

  /**
   * Xóa entity
   */
  deleteEntity(requester: Requester, id: string): Promise<void>;
}

/**
 * Interface cơ bản cho CRUD repository
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 */
export interface ICrudRepository<T, C, U> {
  /**
   * Lấy entity theo ID
   */
  get(id: string): Promise<T | null>;

  /**
   * Tìm entity theo điều kiện
   */
  findByCond(conditions: any): Promise<T | null>;

  /**
   * Lấy danh sách entity với phân trang
   */
  list(conditions: any, pagination: PagingDTO): Promise<Paginated<T>>;

  /**
   * Tạo mới entity
   */
  insert(entity: any): Promise<string>;

  /**
   * Cập nhật entity
   */
  update(id: string, dto: Partial<T>): Promise<void>;

  /**
   * Xóa entity
   */
  delete(id: string): Promise<void>;
}

/**
 * Interface cho các operation hook
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 */
export interface ICrudHooks<T, C, U> {
  /**
   * Hook trước khi tạo entity
   */
  beforeCreate?: (dto: C, requester: Requester) => Promise<C>;

  /**
   * Hook sau khi tạo entity
   */
  afterCreate?: (entity: T, id: string, requester: Requester) => Promise<void>;

  /**
   * Hook trước khi cập nhật entity
   */
  beforeUpdate?: (id: string, dto: U, requester: Requester) => Promise<U>;

  /**
   * Hook sau khi cập nhật entity
   */
  afterUpdate?: (entity: T, requester: Requester) => Promise<void>;

  /**
   * Hook trước khi xóa entity
   */
  beforeDelete?: (id: string, requester: Requester) => Promise<boolean>;

  /**
   * Hook sau khi xóa entity
   */
  afterDelete?: (id: string, requester: Requester) => Promise<void>;

  /**
   * Hook trước khi lấy danh sách entity
   */
  beforeList?: (
    conditions: any,
    pagination: PagingDTO,
    requester: Requester,
  ) => Promise<{ conditions: any; pagination: PagingDTO }>;

  /**
   * Hook sau khi lấy danh sách entity
   */
  afterList?: (
    result: Paginated<T>,
    requester: Requester,
  ) => Promise<Paginated<T>>;
}
