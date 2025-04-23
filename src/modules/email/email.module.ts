import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_SERVICE } from './email.di-token';
import { NodemailerService } from './nodemailer.service';
import { ConsoleEmailService } from './console.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_SERVICE,
      useFactory: (configService: ConfigService) => {
        const emailEnabled =
          configService.get<string>('EMAIL_ENABLED', 'false') === 'true';
        if (emailEnabled) {
          return new NodemailerService(configService);
        } else {
          return new ConsoleEmailService();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
