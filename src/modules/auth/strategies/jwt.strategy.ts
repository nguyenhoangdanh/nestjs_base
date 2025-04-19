// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { config } from '../../../share/config';
import { TOKEN_SERVICE } from '../auth.di-token';
import { ITokenService } from '../auth.interface';
import { USER_REPOSITORY } from '../../user/user.di-token';
import { IUserRepository } from '../../user/user.port';
import { UserStatus } from '../../user/user.model';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.accessToken,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload: any) {
    // Lấy token gốc từ request
    const token =
      request.cookies?.accessToken ||
      request.headers?.authorization?.split(' ')[1];

    // Kiểm tra token có trong blacklist không
    if (token) {
      const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return null; // Token đã bị vô hiệu hóa
      }
    }

    // Lấy thông tin người dùng để xác nhận họ vẫn tồn tại và đang hoạt động
    const user = await this.userRepo.get(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    // Trả về thông tin người dùng đã được xác thực
    return {
      sub: payload.sub,
      roleId: payload.roleId,
      role: payload.role,
      factoryId: payload.factoryId,
      lineId: payload.lineId,
      teamId: payload.teamId,
      groupId: payload.groupId,
    };
  }
}