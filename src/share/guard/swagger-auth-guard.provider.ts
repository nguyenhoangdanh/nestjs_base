import { Provider } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SwaggerAuthGuard } from './swagger-auth.guard';
import { TOKEN_INTROSPECTOR } from '../di-token';

export const SwaggerAuthGuardProvider: Provider = {
  provide: SwaggerAuthGuard,
  useFactory: (reflector: Reflector, tokenIntrospector) => {
    return new SwaggerAuthGuard(reflector, tokenIntrospector);
  },
  inject: [Reflector, TOKEN_INTROSPECTOR],
};
