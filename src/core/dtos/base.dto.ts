// src/core/dtos/base.dto.ts
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationRequestDto } from './pagination.dto';

export class BaseDto {
  @IsUUID()
  @IsOptional()
  id?: string;
}

export class BaseCreateDto {
  // Các trường cơ bản cho việc tạo mới
}

export class BaseUpdateDto {
  @IsUUID(4, { message: 'ID không hợp lệ' })
  id: string;
}

export class BaseQueryDto extends PaginationRequestDto {
  @IsOptional()
  sortBy?: string;

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
