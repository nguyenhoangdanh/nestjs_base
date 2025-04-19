import { UserRole } from 'src/share';
import { PaginationDTO } from '../user/user.dto';
import { RoleCondDTO, RoleDTO } from './role.dto';
import { Role, RoleWithRelations } from './role.model';

// Interface cho role repository
export interface IRoleRepository {
  get(id: string): Promise<Role | null>;
  getWithRelations(id: string): Promise<RoleWithRelations | null>;
  getByCode(code: string): Promise<Role | null>;
  findByCond(cond: RoleCondDTO): Promise<Role | null>;
  list(
    conditions: RoleCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Role[];
    total: number;
  }>;
  insert(role: Role): Promise<void>;
  update(id: string, dto: Partial<Role>): Promise<void>;
  delete(id: string): Promise<void>;

  // Thêm các phương thức để làm việc với quan hệ
  checkRoleIsInUse(id: string): Promise<boolean>;
}

// Interface cho role service
export interface IRoleService {
  createRole(dto: RoleDTO): Promise<string>;
  updateRole(id: string, dto: RoleDTO, role?: UserRole): Promise<void>;
  deleteRole(id: string): Promise<void>;
  getRole(id: string): Promise<Role>;
  getRoleWithRelations(id: string): Promise<RoleWithRelations>;
  getRoleByCode(code: UserRole | string): Promise<Role>;
  listRoles(
    conditions: RoleCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Role[];
    total: number;
    page: number;
    limit: number;
  }>;
}
