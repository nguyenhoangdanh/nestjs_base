// src/modules/users/dtos/user-query.dto.ts
import { IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseQueryDto } from './base.dto';

export class UserQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isTwoFactorEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  roleId?: string;
}
