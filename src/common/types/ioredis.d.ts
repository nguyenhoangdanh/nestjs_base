import 'ioredis';

declare module 'ioredis' {
  namespace Redis {
    export class ReplyError extends Error {
      name: 'ReplyError';
      command: {
        name: string;
        args: Array<string>;
      };
      code?: string;
    }
  }
}
