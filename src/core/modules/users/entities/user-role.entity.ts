// src/modules/roles/entities/role.entity.ts
import { BaseEntity } from 'src/core/entities/base.entity';
import { UserRole } from 'src/share';
import { Entity, Column, OneToMany } from 'typeorm';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];
}
