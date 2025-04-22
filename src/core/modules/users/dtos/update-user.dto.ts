// src/modules/users/dtos/update-user.dto.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseUpdateDto } from 'src/core/dtos/base.dto';

export class UpdateUserDto extends BaseUpdateDto {
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
  @MinLength(8)
  password?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isTwoFactorEnabled?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsUUID(4, { each: true })
  roleIds?: string[];
}
