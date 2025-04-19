import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ITokenIntrospect, TokenIntrospectResult } from '../interface';

// 200Lab Note: we might use HTTP Module of NestJS instead of axios directly
// but for now, we use axios to make it simple
@Injectable()
export class TokenIntrospectRPCClient implements ITokenIntrospect {
  constructor(private readonly url: string) {}

  async introspect(token: string): Promise<TokenIntrospectResult> {
    try {
      const { data } = await axios.post(`${this.url}`, { token });
      const { sub, role, roleId } = data.data;
      // Decode JWT token để lấy role nếu service không trả về
      let extractedRole = role;
      if (!extractedRole && token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64').toString('utf8'),
            );
            extractedRole = payload.role;
          }
        } catch (e) {
          console.error('Error extracting role from token:', e);
        }
      }

      return {
        payload: {
          sub,
          role: extractedRole, // Sử dụng role từ token nếu service không trả về
          roleId,
        },
        isOk: true,
      };
    } catch (error) {
      return {
        payload: null,
        error: error as Error,
        isOk: false,
      };
    }
  }

  /**
   * Checks if the token is blacklisted in the remote service
   * @param token The token to check
   * @returns Promise<boolean> True if the token is blacklisted, false otherwise
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      // Call the remote service to check if the token is blacklisted
      const { data } = await axios.post(`${this.url}/blacklist/check`, {
        token,
      });
      return data.isBlacklisted === true;
    } catch (error) {
      // Log the error
      console.error('Error checking token blacklist status:', error);

      // If we can't reach the service, assume token is valid (not blacklisted)
      // This is a safe default, as the introspect method will still validate the token
      return false;
    }
  }
}
