// src/core/interfaces/paginated-result.interface.ts
import { PaginationMetaDto } from '../dtos/pagination.dto';

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMetaDto;
}
