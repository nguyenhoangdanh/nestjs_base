import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { config } from '../../share/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Ưu tiên lấy token từ cookie
        (request: Request) => {
          return request?.cookies?.accessToken;
        },
        // Lấy token từ Authorization header nếu không có trong cookie
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
      passReqToCallback: true, // Cho phép truy cập vào request object trong validate
    });
  }

  async validate(request: Request, payload: any) {
    // Kiểm tra nếu request đến từ Swagger
    const isSwaggerRequest = request.headers['x-from-swagger'] === 'true';

    // Thêm thông tin này vào payload để có thể sử dụng trong guard
    return {
      ...payload,
      isSwaggerRequest,
    };
  }
}
