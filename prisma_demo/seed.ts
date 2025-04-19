// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function hashPassword(
  password: string,
): Promise<{ hashedPassword: string; salt: string }> {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(`${password}.${salt}`, 12);
  return { hashedPassword, salt };
}

async function main() {
  console.log('Seeding database...');

  // Seed roles
  const roles = [
    {
      id: uuidv4(),
      code: 'WORKER',
      name: 'Công nhân',
      description: 'Người thực hiện công việc sản xuất',
      level: 1,
      isSystem: true,
    },
    {
      id: uuidv4(),
      code: 'GROUP_LEADER',
      name: 'Nhóm trưởng',
      description: 'Người quản lý nhóm công nhân',
      level: 2,
      isSystem: true,
    },
    {
      id: uuidv4(),
      code: 'TEAM_LEADER',
      name: 'Tổ trưởng',
      description: 'Người quản lý tổ sản xuất',
      level: 3,
      isSystem: true,
    },
    {
      id: uuidv4(),
      code: 'LINE_MANAGER',
      name: 'Quản lý line',
      description: 'Người quản lý dây chuyền sản xuất',
      level: 4,
      isSystem: true,
    },
    {
      id: uuidv4(),
      code: 'FACTORY_MANAGER',
      name: 'Quản lý nhà máy',
      description: 'Người quản lý nhà máy',
      level: 5,
      isSystem: true,
    },
    {
      id: uuidv4(),
      code: 'ADMIN',
      name: 'Quản trị viên',
      description: 'Người quản trị hệ thống',
      level: 6,
      isSystem: true,
    },
    {
      id: uuidv4(),
      code: 'SUPER_ADMIN',
      name: 'Quản trị viên cao cấp',
      description: 'Người quản trị hệ thống với quyền cao nhất',
      level: 7,
      isSystem: true,
    },
  ];

  // Seed các role
  console.log('Seeding roles...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        level: role.level,
        isSystem: role.isSystem,
      },
    });
  }
  console.log('Roles seeded successfully!');

  // Lấy role Super Admin
  const superAdminRole = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMIN' },
  });

  if (!superAdminRole) {
    throw new Error('Super Admin role not found!');
  }

  // Hash password cho admin
  const { hashedPassword, salt } = await hashPassword('Admin@123');

  // Tạo Super Admin user
  console.log('Creating Super Admin user...');
  const adminId = uuidv4();

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      id: adminId,
      employeeId: '552502356',
      cardId: '089200019700',
      username: '552502356',
      password: hashedPassword,
      salt: salt,
      fullName: 'Super Admin',
      email: 'hoangdanh54317@gmail.com',
      phone: '0123456789',
      status: 'ACTIVE',
      roleId: superAdminRole.id,
    },
  });

  // Tạo UserRoleAssignment cho Super Admin
  console.log('Assigning role to Super Admin...');
  await prisma.userRoleAssignment.upsert({
    where: {
      id: uuidv4(),
    },
    update: {},
    create: {
      id: uuidv4(),
      userId: adminId,
      roleId: superAdminRole.id,
      scope: null, // Super Admin có quyền toàn bộ hệ thống, không cần scope
    },
  });

  console.log('Super Admin created successfully!');
  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Đóng kết nối Prisma khi hoàn thành
    await prisma.$disconnect();
  });
