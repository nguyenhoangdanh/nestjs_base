import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from './email.port';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class NodemailerService implements IEmailService {
  private readonly logger = new Logger(NodemailerService.name);
  private transporter: nodemailer.Transporter;
  private readonly templatesDir: string;
  private readonly templates: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize email configuration
    this.appName = this.configService.get<string>('APP_NAME', 'Your App');
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    this.fromEmail = this.configService.get<string>(
      'EMAIL_FROM',
      `"${this.appName}" <noreply@example.com>`,
    );

    // Set up templates directory
    this.templatesDir = path.join(__dirname, '../../templates/emails');
    this.loadTemplates();

    // Create Nodemailer transporter
    const useTestAccount =
      this.configService.get<string>('EMAIL_USE_TEST_ACCOUNT', 'false') ===
      'true';

    if (useTestAccount) {
      this.createTestTransporter();
    } else {
      this.createProductionTransporter();
    }
  }

  async sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<void> {
    const verificationUrl = `${this.appUrl}/auth/verify-email/${token}`;
    const context = {
      appName: this.appName,
      name: name || 'User',
      verificationUrl,
    };

    await this.sendEmail(
      to,
      `Verify your email for ${this.appName}`,
      'verification',
      context,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<void> {
    const resetUrl = `${this.appUrl}/auth/reset-password/${token}`;
    const context = {
      appName: this.appName,
      name: name || 'User',
      resetUrl,
    };

    await this.sendEmail(
      to,
      `Reset your password for ${this.appName}`,
      'password-reset',
      context,
    );
  }

  async sendWelcomeEmail(to: string, name: string | null): Promise<void> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      loginUrl: `${this.appUrl}/auth/login`,
    };

    await this.sendEmail(to, `Welcome to ${this.appName}!`, 'welcome', context);
  }

  async sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<void> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      codes,
    };

    await this.sendEmail(
      to,
      `Your 2FA backup codes for ${this.appName}`,
      '2fa-backup-codes',
      context,
    );
  }

  async sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<void> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      device,
      location,
      time: time.toLocaleString(),
      accountSettingsUrl: `${this.appUrl}/account/security`,
    };

    await this.sendEmail(
      to,
      `New login to your ${this.appName} account`,
      'login-notification',
      context,
    );
  }

  async sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<void> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      device,
      location,
      time: time.toLocaleString(),
      resetPasswordUrl: `${this.appUrl}/auth/forgot-password`,
    };

    await this.sendEmail(
      to,
      `Unusual login attempt on your ${this.appName} account`,
      'login-attempt',
      context,
    );
  }

  // Helper methods
  private async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<void> {
    try {
      const compiledTemplate = this.getTemplate(template);
      if (!compiledTemplate) {
        throw new Error(`Email template '${template}' not found`);
      }

      const html = compiledTemplate(context);

      const mailOptions = {
        from: this.fromEmail,
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (
        this.configService.get<string>('EMAIL_USE_TEST_ACCOUNT', 'false') ===
        'true'
      ) {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }

      this.logger.log(`Email sent: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      // Don't throw, just log - email failures shouldn't break application flow
    }
  }

  private async createTestTransporter(): Promise<void> {
    try {
      // Create a test account using Ethereal
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.logger.log(`Created test email account: ${testAccount.user}`);
    } catch (error) {
      this.logger.error(
        `Failed to create test email transporter: ${error.message}`,
        error.stack,
      );
    }
  }

  private createProductionTransporter(): void {
    try {
      const emailHost = this.configService.get<string>(
        'EMAIL_HOST',
        'smtp.example.com',
      );
      const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
      const emailUser = this.configService.get<string>('EMAIL_USER', '');
      const emailPass = this.configService.get<string>('EMAIL_PASS', '');
      const emailSecure =
        this.configService.get<string>('EMAIL_SECURE', 'false') === 'true';

      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailSecure,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      this.logger.log(
        `Created production email transporter with host ${emailHost}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create production email transporter: ${error.message}`,
        error.stack,
      );
    }
  }

  private loadTemplates(): void {
    try {
      // Create templates directory if it doesn't exist
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
        this.createDefaultTemplates();
      }

      // Load templates from the directory
      const files = fs.readdirSync(this.templatesDir);

      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '');
          const templatePath = path.join(this.templatesDir, file);
          const templateSource = fs.readFileSync(templatePath, 'utf8');

          this.templates.set(templateName, Handlebars.compile(templateSource));
          this.logger.log(`Loaded email template: ${templateName}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to load email templates: ${error.message}`,
        error.stack,
      );
    }
  }

  private getTemplate(name: string): HandlebarsTemplateDelegate | undefined {
    // Check if template exists
    if (!this.templates.has(name)) {
      // Create default template if it doesn't exist
      this.createDefaultTemplate(name);
    }

    return this.templates.get(name);
  }

  private createDefaultTemplates(): void {
    // Create basic templates if they don't exist
    this.createDefaultTemplate('verification');
    this.createDefaultTemplate('password-reset');
    this.createDefaultTemplate('welcome');
    this.createDefaultTemplate('2fa-backup-codes');
    this.createDefaultTemplate('login-notification');
    this.createDefaultTemplate('login-attempt');
  }

  private createDefaultTemplate(name: string): void {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.hbs`);

      // Skip if template already exists
      if (fs.existsSync(templatePath)) {
        return;
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
      }

      // Get default template content
      const content = this.getDefaultTemplateContent(name);

      // Write template file
      fs.writeFileSync(templatePath, content);

      // Compile and add to templates map
      this.templates.set(name, Handlebars.compile(content));

      this.logger.log(`Created default email template: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to create default template '${name}': ${error.message}`,
        error.stack,
      );
    }
  }

  private getDefaultTemplateContent(name: string): string {
    // Default template content based on template name
    switch (name) {
      case 'verification':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verify your email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Verify your email for {{appName}}</h2>
  <p>Hello {{name}},</p>
  <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
  <p>
    <a href="{{verificationUrl}}" style="display: inline-block; background-color: #4CAF50; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Verify Email</a>
  </p>
  <p>Or copy and paste this link into your browser:</p>
  <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
  <p>If you did not create an account, please ignore this email.</p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;

      case 'password-reset':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reset your password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Reset your password for {{appName}}</h2>
  <p>Hello {{name}},</p>
  <p>We received a request to reset your password. Click the button below to create a new password:</p>
  <p>
    <a href="{{resetUrl}}" style="display: inline-block; background-color: #2196F3; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Reset Password</a>
  </p>
  <p>Or copy and paste this link into your browser:</p>
  <p><a href="{{resetUrl}}">{{resetUrl}}</a></p>
  <p>If you didn't request this password reset, you can ignore this email. Your password will not be changed.</p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;

      case 'welcome':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Welcome to {{appName}}!</h2>
  <p>Hello {{name}},</p>
  <p>Thank you for joining our community! We're excited to have you on board.</p>
  <p>You can login to your account at any time by visiting:</p>
  <p><a href="{{loginUrl}}">{{loginUrl}}</a></p>
  <p>If you have any questions or need assistance, feel free to contact our support team.</p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;

      case '2fa-backup-codes':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your 2FA Backup Codes</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Your Two-Factor Authentication Backup Codes</h2>
  <p>Hello {{name}},</p>
  <p>Here are your backup codes for two-factor authentication on {{appName}}. Each code can only be used once.</p>
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; margin: 20px 0;">
    {{#each codes}}
    <div style="margin: 5px 0;">{{this}}</div>
    {{/each}}
  </div>
  <p>Please store these codes in a safe place. They can be used to access your account if you lose your authentication device.</p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;

      case 'login-notification':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>New Login Notification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>New Login to Your Account</h2>
  <p>Hello {{name}},</p>
  <p>We detected a new login to your {{appName}} account.</p>
  <p><strong>Device:</strong> {{device}}</p>
  <p><strong>Location:</strong> {{location}}</p>
  <p><strong>Time:</strong> {{time}}</p>
  <p>If this was you, you can ignore this email. If you don't recognize this activity, please secure your account by:</p>
  <ol>
    <li>Changing your password immediately</li>
    <li>Enabling two-factor authentication if you haven't already</li>
    <li>Reviewing your account activity</li>
  </ol>
  <p>
    <a href="{{accountSettingsUrl}}" style="display: inline-block; background-color: #FF5722; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Review Account Security</a>
  </p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;

      case 'login-attempt':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Unusual Login Attempt</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #D32F2F;">Unusual Login Attempt Detected</h2>
  <p>Hello {{name}},</p>
  <p>We detected an unusual login attempt to your {{appName}} account that was blocked.</p>
  <p><strong>Device:</strong> {{device}}</p>
  <p><strong>Location:</strong> {{location}}</p>
  <p><strong>Time:</strong> {{time}}</p>
  <p>If this was you, you may need to reset your password. If you don't recognize this activity, we recommend:</p>
  <ol>
    <li>Resetting your password immediately</li>
    <li>Enabling two-factor authentication if you haven't already</li>
    <li>Checking your account for any unusual activity</li>
  </ol>
  <p>
    <a href="{{resetPasswordUrl}}" style="display: inline-block; background-color: #D32F2F; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Reset Password</a>
  </p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;

      default:
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{appName}} Notification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Notification from {{appName}}</h2>
  <p>Hello {{name}},</p>
  <p>This is a notification from {{appName}}.</p>
  <p>Thanks,<br>The {{appName}} Team</p>
</body>
</html>`;
    }
  }
}
