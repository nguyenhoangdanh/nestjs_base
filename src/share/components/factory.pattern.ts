import { PrismaService } from '../prisma.service';

export class EntityAccessService {
  constructor(private prisma: PrismaService) {}

  // Kiểm tra người dùng có quyền truy cập factory không
  async canAccessFactory(userId: string, factoryId: string): Promise<boolean> {
    // Kiểm tra user có phải là quản lý factory không
    const manager = await this.prisma.factoryManager.findFirst({
      where: {
        factoryId,
        userId,
        endDate: {
          gte: new Date(),
        },
      },
    });

    if (manager) return true;

    // Kiểm tra theo vai trò FACTORY_MANAGER, ADMIN, SUPER_ADMIN
    // Example fixed code
    const userRole = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        OR: [
          {
            role: {
              code: 'FACTORY_MANAGER',
            },
            scope: `factory:${factoryId}`,
          },
          { role: { code: 'ADMIN' } },
          { role: { code: 'SUPER_ADMIN' } },
        ],
      },
    });

    return !!userRole;
  }

  // Tương tự cho Line, Team, Group...
}
