// src/modules/auth/auth.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AppError, ReqWithRequester, TokenPayload } from '../../share';
import { USER_REPOSITORY } from '../user/user.di-token';
import { IUserRepository } from '../user/user.port';
import {
  UserLoginDTO,
  UserRegistrationDTO,
  RequestPasswordResetDTO,
  UserResetPasswordDTO,
} from '../user/user.dto';
import {
  User,
  UserStatus,
  ErrUsernameExisted,
  ErrInvalidUsernameAndPassword,
  ErrUserInactivated,
  ErrInvalidToken,
  ErrExistsPassword,
  ErrMissingResetCredentials,
  ErrInvalidResetToken,
} from '../user/user.model';
import { TOKEN_SERVICE } from './auth.di-token';
import { IAuthService, ITokenService } from './auth.interface';
import { ROLE_SERVICE } from '../role/role.di-token';
import { IRoleService } from '../role/role.port';
import { UserRole } from '../../share/interface';

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(ROLE_SERVICE) private readonly roleService: IRoleService,
  ) {}

  async register(dto: UserRegistrationDTO): Promise<{ userId: string }> {
    try {
      // Kiểm tra username đã tồn tại chưa
      const existingUser = await this.userRepo.findByUsername(dto.username);
      if (existingUser) {
        throw AppError.from(ErrUsernameExisted, 400);
      }

      // Tạo salt và hash password
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = await bcrypt.hash(`${dto.password}.${salt}`, 12);

      // Tạo ID mới
      const newId = uuidv4();

      // Lấy roleId từ defaultRoleCode
      let defaultRoleId: string;
      if (dto.roleId) {
        const role = await this.roleService.getRole(dto.roleId);
        defaultRoleId = role.id;
      } else {
        const defaultRole = await this.roleService.getRoleByCode(
          dto.defaultRoleCode || UserRole.WORKER,
        );
        defaultRoleId = defaultRole.id;
      }

      // Tạo user mới
      const newUser: User = {
        ...dto,
        password: hashPassword,
        username: dto.username,
        id: newId,
        status: dto.status || UserStatus.PENDING_ACTIVATION,
        salt: salt,
        roleId: defaultRoleId,
        createdAt: new Date(),
        updatedAt: new Date(),
        fullName: dto.fullName,
        employeeId: dto.employeeId,
        cardId: dto.cardId,
        factoryId: dto.factoryId || null,
        lineId: dto.lineId || null,
        teamId: dto.teamId || null,
        groupId: dto.groupId || null,
        positionId: dto.positionId || null,
      };

      // Lưu vào database
      await this.userRepo.insert(newUser);

      this.logger.log(`User registered: ${dto.username} (${newId})`);
      return { userId: newId };
    } catch (error) {
      this.logger.error(
        `Error during registration: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi đăng ký: ${error.message}`),
        400,
      );
    }
  }

  async login(
    dto: UserLoginDTO,
    res: Response,
  ): Promise<{
    token: string;
    expiresIn: number;
    requiredResetPassword: boolean;
  }> {
    try {
      // Tìm user theo username
      const user = await this.userRepo.findByUsername(dto.username);
      if (!user) {
        throw AppError.from(ErrInvalidUsernameAndPassword, 400);
      }

      // Kiểm tra trạng thái tài khoản
      if (
        user.status !== UserStatus.ACTIVE &&
        user.status !== UserStatus.PENDING_ACTIVATION
      ) {
        throw AppError.from(ErrUserInactivated, 400);
      }

      // Xác thực mật khẩu
      const isMatch = await bcrypt.compare(
        `${dto.password}.${user.salt}`,
        user.password,
      );
      if (!isMatch) {
        throw AppError.from(ErrInvalidUsernameAndPassword, 400);
      }

      // Xác định thời gian hết hạn token
      const expiresIn = dto.rememberMe ? '7d' : '1d'; // 7 ngày hoặc 1 ngày

      // Tạo payload
      const tokenPayload: TokenPayload = {
        sub: user.id,
        roleId: user.roleId,
        role: user.role,
        factoryId: user.factoryId || undefined,
        lineId: user.lineId || undefined,
        teamId: user.teamId || undefined,
        groupId: user.groupId || undefined,
      };

      // Tạo token JWT
      const token = await this.tokenService.generateToken(
        tokenPayload,
        expiresIn,
      );

      // Tính thời gian hết hạn token (giây)
      const expirationTime = this.tokenService.getExpirationTime(token);

      // Cập nhật lastLogin
      await this.userRepo.update(user.id, {
        lastLogin: new Date(),
        status:
          user.status === UserStatus.PENDING_ACTIVATION
            ? UserStatus.PENDING_ACTIVATION
            : user.status,
      });

      // Set HTTP-only cookie với token
      res.cookie('accessToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: expirationTime * 1000, // Convert seconds to milliseconds
      });

      this.logger.log(`User logged in: ${user.username} (${user.id})`);

      return {
        token,
        expiresIn: expirationTime,
        requiredResetPassword: user.status === UserStatus.PENDING_ACTIVATION,
      };
    } catch (error) {
      this.logger.error(`Login error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi đăng nhập: ${error.message}`),
        400,
      );
    }
  }

  async logout(req: ReqWithRequester, res: Response): Promise<void> {
    try {
      // Lấy token từ cookie hoặc header
      const cookieToken = req.cookies?.accessToken;
      const headerToken = req.headers.authorization?.split(' ')[1];

      this.logger.debug(
        `Logout - Cookie token exists: ${!!cookieToken}, Auth header exists: ${!!headerToken}`,
      );

      // Đăng xuất và vô hiệu hóa tất cả các token có sẵn
      if (cookieToken) {
        await this.tokenService.blacklistToken(
          cookieToken,
          this.tokenService.getExpirationTime(cookieToken),
        );
      }

      if (headerToken && headerToken !== cookieToken) {
        await this.tokenService.blacklistToken(
          headerToken,
          this.tokenService.getExpirationTime(headerToken),
        );
      }

      // Xóa cookie
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });

      // For better security, tell browsers to clear Authorization header
      res.setHeader('Clear-Site-Data', '"cookies", "storage"');

      this.logger.log(`User logged out: ${req.requester.sub}`);
    } catch (error) {
      this.logger.error(`Error during logout: ${error.message}`, error.stack);
      // Vẫn trả về thành công ngay cả khi có lỗi
    }
  }

  async refreshToken(
    token: string,
  ): Promise<{ token: string; expiresIn: number }> {
    // Giải mã token hiện tại (không xác thực)
    const payload = this.tokenService.decodeToken(token);
    if (!payload) {
      throw AppError.from(ErrInvalidToken, 401);
    }

    // Kiểm tra token có trong blacklist không
    const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw AppError.from(ErrInvalidToken, 401);
    }

    // Lấy thông tin user để đảm bảo họ vẫn tồn tại và đang hoạt động
    const user = await this.userRepo.get(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw AppError.from(ErrUserInactivated, 403);
    }

    // Tạo token mới với cùng payload nhưng thời hạn mới
    const newToken = await this.tokenService.generateToken({
      sub: user.id,
      roleId: user.roleId,
      role: user.role,
      factoryId: user.factoryId || undefined,
      lineId: user.lineId || undefined,
      teamId: user.teamId || undefined,
      groupId: user.groupId || undefined,
    });

    // Tính thời gian hết hạn
    const expiresIn = this.tokenService.getExpirationTime(newToken);

    // Đưa token cũ vào blacklist
    const oldTokenExpiresIn = this.tokenService.getExpirationTime(token);
    if (oldTokenExpiresIn > 0) {
      await this.tokenService.blacklistToken(token, oldTokenExpiresIn);
    }

    return { token: newToken, expiresIn };
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDTO,
  ): Promise<{ resetToken: string; expiryDate: Date; username: string }> {
    let user: User | null = null;

    // Tìm user dựa trên thông tin đã cung cấp
    if (dto.username) {
      user = await this.userRepo.findByUsername(dto.username);
    } else if (dto.cardId && dto.employeeId) {
      user = await this.userRepo.findByCardId(dto.cardId, dto.employeeId);
    } else {
      throw AppError.from(ErrMissingResetCredentials, 400);
    }

    if (!user) {
      throw AppError.from(new Error('User not found'), 404);
    }

    // Tạo token đặt lại mật khẩu
    const resetToken = await this.tokenService.generateResetToken();

    // Đặt thời hạn hết hạn là 1 giờ từ bây giờ
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    // Lưu token đặt lại vào user
    await this.userRepo.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpiry: expiryDate,
      updatedAt: new Date(),
    });

    this.logger.log(`Password reset requested for user: ${user.id}`);

    return { resetToken, expiryDate, username: user.username };
  }

  async resetPassword(dto: UserResetPasswordDTO): Promise<void> {
    let user: User | null = null;

    // Tìm user dựa trên thông tin đã cung cấp
    if (dto.resetToken) {
      // Nếu có reset token, sử dụng nó để tìm user
      user = await this.userRepo.findByResetToken(dto.resetToken);

      // Xác minh token hợp lệ và chưa hết hạn
      if (
        !user ||
        !user.passwordResetExpiry ||
        user.passwordResetExpiry < new Date()
      ) {
        throw AppError.from(ErrInvalidResetToken, 400);
      }
    } else if (dto.username) {
      // Nếu có username, tìm theo username
      user = await this.userRepo.findByUsername(dto.username);
    } else if (dto.cardId && dto.employeeId) {
      // Nếu có cardId và employeeId, tìm theo chúng
      user = await this.userRepo.findByCardId(dto.cardId, dto.employeeId);
    } else {
      throw AppError.from(ErrMissingResetCredentials, 400);
    }

    if (!user) {
      throw AppError.from(new Error('User not found'), 404);
    }

    // Kiểm tra mật khẩu mới có giống mật khẩu cũ không
    const isSamePassword = await bcrypt.compare(
      `${dto.password}.${user.salt}`,
      user.password,
    );
    if (isSamePassword) {
      throw AppError.from(ErrExistsPassword, 400);
    }

    // Tạo salt và hash mới cho mật khẩu mới
    const salt = bcrypt.genSaltSync(10);
    const hashPassword = await bcrypt.hash(`${dto.password}.${salt}`, 12);

    // Cập nhật user với mật khẩu mới và xóa reset token
    await this.userRepo.update(user.id, {
      password: hashPassword,
      salt,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date(),
      status:
        user.status === UserStatus.PENDING_ACTIVATION
          ? UserStatus.ACTIVE
          : user.status,
    });

    this.logger.log(`Password reset completed for user: ${user.id}`);
  }

  // Phương thức hỗ trợ local strategy
  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) return null;
    
    const isMatch = await bcrypt.compare(
      `${password}.${user.salt}`,
      user.password,
    );
    
    if (isMatch) {
      const { password, salt, ...result } = user;
      return result;
    }
    return null;
  }
}