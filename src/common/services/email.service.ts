import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import * as fs from 'fs';
import * as path from 'path';

type SendMailOptions = {
  from: string | { email: string; name?: string };
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

@Injectable()
export class EmailService {
  private templateCache = new Map<string, string>();
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');

    if (!apiKey) {
      console.warn(
        'Email configuration is incomplete. Please set SENDGRID_API_KEY in .env',
      );
      return;
    }

    sgMail.setApiKey(apiKey);
    this.isConfigured = true;
  }

  private buildFrom(from: SendMailOptions['from']): {
    email: string;
    name?: string;
  } {
    if (typeof from === 'object') return from;

    const match = from.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { email: from.trim() };
  }

  private async sendWithRetry(
    mailOptions: SendMailOptions,
    maxRetries: number = 3,
  ): Promise<{ messageId?: string }> {
    if (!this.isConfigured) {
      throw new Error(
        'SendGrid is not configured. Set SENDGRID_API_KEY in environment.',
      );
    }

    const payload: MailDataRequired = {
      from: this.buildFrom(mailOptions.from),
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
    } as MailDataRequired;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const [response] = await sgMail.send(payload);
        const messageId =
          (response?.headers?.['x-message-id'] as string | undefined) ??
          undefined;
        return { messageId };
      } catch (error: unknown) {
        lastError = error;
        const err = error as {
          code?: number;
          response?: {
            statusCode?: number;
            body?: unknown;
          };
          message?: string;
        };
        const statusCode: number | undefined =
          err?.code ?? err?.response?.statusCode;
        const isTransient =
          statusCode === 429 ||
          (typeof statusCode === 'number' && statusCode >= 500);

        if (isTransient && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `[EmailService] Transient SendGrid error (${statusCode}). Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        console.error(
          `[EmailService] Non-transient SendGrid error (${statusCode}). Stopping retry attempts.`,
          err?.response?.body ?? err?.message ?? err,
        );
        throw error;
      }
    }

    console.error(
      `[EmailService] All ${maxRetries} retry attempts failed for ${mailOptions.to}`,
    );
    throw lastError;
  }

  private loadTemplate(templateName: string, fallbackHtml: string): string {
    const cached = this.templateCache.get(templateName);
    if (cached) return cached;

    try {
      const distPath = path.join(
        process.cwd(),
        'dist',
        'templates',
        `${templateName}.html`,
      );
      if (fs.existsSync(distPath)) {
        const content = fs.readFileSync(distPath, 'utf8');
        this.templateCache.set(templateName, content);
        return content;
      }

      const isProduction =
        process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
      if (!isProduction) {
        const srcPath = path.join(
          process.cwd(),
          'src',
          'templates',
          `${templateName}.html`,
        );
        if (fs.existsSync(srcPath)) {
          const content = fs.readFileSync(srcPath, 'utf8');
          this.templateCache.set(templateName, content);
          return content;
        }
      }

      return fallbackHtml;
    } catch {
      return fallbackHtml;
    }
  }

  private getOtpEmailHtml(otp: string, appName: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Code</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .otp-box { background-color: #fff; border: 2px solid #007bff; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName} - Verification Code</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Your verification code is:</p>
          <div class="otp-box">${otp}</div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private getCredentialsEmailHtml(
    email: string,
    password: string,
    appName: string,
    loginUrl?: string,
    role: string = 'Member',
  ): string {
    void loginUrl; // parameter kept for API compatibility
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Created</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 16px;
            color: #333;
            margin-bottom: 20px;
        }
        .role-badge {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            text-transform: capitalize;
        }
        .credentials-section {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .credentials-section h3 {
            margin-top: 0;
            color: #667eea;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .credential-item {
            margin: 15px 0;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .credential-item:last-child {
            border-bottom: none;
        }
        .credential-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .credential-value {
            font-size: 16px;
            color: #333;
            font-weight: 600;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }
        .security-note {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 30px 0;
            border-radius: 4px;
            font-size: 14px;
            color: #856404;
        }
        .security-note strong {
            color: #721c24;
        }
        .action-section {
            text-align: center;
            margin: 30px 0;
        }
        .login-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 40px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .login-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome!</h1>
            <p>Your account has been created</p>
        </div>

        <div class="content">
            <div class="greeting">
                <p>Hello,</p>
                <p>Your account has been successfully created with the following role:</p>
            </div>

            <div style="text-align: center;">
                <span class="role-badge">${role}</span>
            </div>

            <p style="color: #666; line-height: 1.6;">
                Your administrator has granted you access to the system with proper privileges. 
                Please use the credentials below to log in and get started.
            </p>

            <div class="credentials-section">
                <h3>Login Credentials</h3>
                <div class="credential-item">
                    <div class="credential-label">📧 Email Address</div>
                    <div class="credential-value">${email}</div>
                </div>
                <div class="credential-item">
                    <div class="credential-label">🔐 Password</div>
                    <div class="credential-value">${password}</div>
                </div>
            </div>

            <div class="security-note">
                <strong>⚠️ Security Notice:</strong> Please change your password on your first login. 
                Keep your login credentials safe and never share them with anyone. 
                Never share this email with unauthorized parties.
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you have any questions or need assistance, please contact our support team.
            </p>
        </div>

        <div class="footer">
            <p><strong>${appName}</strong></p>
            <p>&copy; ${new Date().getFullYear()} All rights reserved</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  async sendOtpEmail(
    email: string,
    otp: string,
    purpose: 'email_verification' | 'password_reset' = 'email_verification',
  ): Promise<boolean> {
    try {
      const appName = this.configService.get<string>(
        'APP_NAME',
        'Aces Certifications',
      );
      const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');
      const fromName = this.configService.get<string>(
        'MAIL_FROM_NAME',
        'Aces Certifications',
      );

      const otpExpiryMinutes =
        Number(this.configService.get<string>('OTP_EXPIRY_MINUTES')) || 10;
      const expiryLabel =
        otpExpiryMinutes === 1 ? '1 minute' : `${otpExpiryMinutes} minutes`;
      const otpConfig = {
        email_verification: {
          title: 'Verify your identity',
          description: `Please use OTP code for Aces Certifications verification. This code expires in ${expiryLabel}.`,
          instructions: 'Enter this code in the verification page to continue.',
          expiry: expiryLabel,
          subject: `Your ${appName} Verification Code`,
          text: `Your verification code is: ${otp}\n\nThis code will expire in ${expiryLabel}.\n\nIf you didn't request this code, please ignore this email.`,
        },
        password_reset: {
          title: 'Reset your password',
          description: `You requested to reset your password. Please use the OTP code below to complete the process. This code expires in ${expiryLabel}.`,
          instructions:
            'Enter this code in the password reset page to set a new password.',
          expiry: expiryLabel,
          subject: `Your ${appName} Password Reset Code`,
          text: `Your password reset code is: ${otp}\n\nThis code will expire in ${expiryLabel}.\n\nIf you didn't request a password reset, please ignore this email and your password will remain unchanged.`,
        },
      };

      const config = otpConfig[purpose];

      const fallbackHtml = this.getOtpEmailHtml(otp, appName);
      let htmlContent = this.loadTemplate('otp-email', fallbackHtml);

      if (htmlContent.includes('{{')) {
        htmlContent = htmlContent
          .replace(/{{\s*OTP_CODE\s*}}/g, otp)
          .replace(/{{\s*OTP_TITLE\s*}}/g, config.title)
          .replace(/{{\s*OTP_DESCRIPTION\s*}}/g, config.description)
          .replace(/{{\s*OTP_INSTRUCTIONS\s*}}/g, config.instructions)
          .replace(/{{\s*OTP_EXPIRY\s*}}/g, config.expiry);
      }

      const safeFromAddress =
        fromAddress ||
        `no-reply@${this.configService.get<string>('APP_DOMAIN', 'localhost')}`;
      const mailOptions = {
        from: `"${fromName}" <${safeFromAddress}>`,
        to: email,
        subject: config.subject,
        html: htmlContent,
        text: config.text,
      };

      const info = await this.sendWithRetry(mailOptions);
      console.log(
        '[EmailService] OTP email sent successfully to',
        email,
        'MessageId:',
        info.messageId ?? 'unknown',
      );
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send OTP email:', error);
      throw new BadRequestException(
        'Failed to send OTP email. Please try again later.',
      );
    }
  }

  async sendCredentialsEmail(
    email: string,
    password: string,
    role: string,
    context?: {
      createdBy?: 'admin' | 'organization';
      organizationName?: string;
      creatorName?: string;
    },
  ): Promise<boolean> {
    try {
      console.log(`[EmailService] Starting credentials email send to ${email}`);

      const appName = this.configService.get<string>(
        'APP_NAME',
        'Aces Certifications',
      );
      const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');
      const fromName = this.configService.get<string>(
        'MAIL_FROM_NAME',
        'Aces Certifications',
      );
      const appUrl = this.configService.get<string>(
        'APP_URL',
        'https://app.example.com',
      );

      console.log(
        `[EmailService] Config - appName: ${appName}, fromName: ${fromName}, appUrl: ${appUrl}`,
      );

      const roleDisplay =
        role === 'subadmin'
          ? 'Sub-Administrator'
          : role === 'auditor'
            ? 'Auditor'
            : role === 'reviewer'
              ? 'Reviewer'
              : role === 'organization'
                ? 'Organization'
                : role === 'organization_member'
                  ? 'Organization Member'
                  : role.charAt(0).toUpperCase() +
                    role.slice(1).replace(/_/g, ' ');

      const fallbackHtml = this.getCredentialsEmailHtml(
        email,
        password,
        appName,
        `${appUrl}/login`,
        roleDisplay,
      );
      let htmlContent = this.loadTemplate(
        'account-created-email',
        fallbackHtml,
      );
      console.log(
        `[EmailService] Template loaded, content length: ${htmlContent.length}`,
      );

      let welcomeMessage =
        'Your account has been successfully created with the following role:';
      let accountDescription = '';

      if (context?.createdBy === 'admin') {
        welcomeMessage = `Your account has been successfully created by the system administrator with the following role:`;
        accountDescription = `The administrator has granted you access to the system with ${roleDisplay} privileges. Please use the credentials below to log in and get started.`;
      } else if (context?.createdBy === 'organization') {
        const orgName = context.organizationName || 'your organization';
        welcomeMessage = `Your account has been successfully created by ${orgName}.`;
        accountDescription = `You have been added as an organization member to ${orgName}. Please use the credentials below to log in and access your organization's dashboard.`;
      } else {
        welcomeMessage =
          'Your account has been successfully created with the following role:';
        accountDescription = `You have been granted access to the system with ${roleDisplay} privileges. Please use the credentials below to log in and get started.`;
      }

      if (htmlContent.includes('{{')) {
        console.log(`[EmailService] Replacing template placeholders`);
        htmlContent = htmlContent
          .replace(/{{\s*email\s*}}/g, email)
          .replace(/{{\s*password\s*}}/g, password)
          .replace(/{{\s*role\s*}}/g, roleDisplay)
          .replace(/{{\s*WELCOME_MESSAGE\s*}}/g, welcomeMessage)
          .replace(/{{\s*ACCOUNT_DESCRIPTION\s*}}/g, accountDescription)
          .replace(/{{\s*loginUrl\s*}}/g, `${appUrl}/login`);
      }

      const safeFromAddress =
        fromAddress ||
        `no-reply@${this.configService.get<string>('APP_DOMAIN', 'localhost')}`;

      console.log(
        `[EmailService] Building mail options - from: ${safeFromAddress}, to: ${email}`,
      );

      const mailOptions = {
        from: `"${fromName}" <${safeFromAddress}>`,
        to: email,
        subject: `${appName} - Your Account is Ready`,
        html: htmlContent,
        text: `Welcome to ${appName}!\n\nYour account has been created.\n\nEmail: ${email}\nPassword: ${password}\n\nPlease log in at: ${appUrl}/login\n\nIMPORTANT: Change your password immediately after login.\n\nIf you didn't request this account, please contact support.`,
      };

      console.log(`[EmailService] Calling sendWithRetry for ${email}`);
      const info = await this.sendWithRetry(mailOptions);
      console.log(
        '[EmailService] Credentials email sent successfully to',
        email,
        'MessageId:',
        info.messageId ?? 'unknown',
      );
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send credentials email:', error);
      throw new BadRequestException(
        'Failed to send credentials email. Please try again later.',
      );
    }
  }

  async sendEmail(
    email: string,
    subject: string,
    htmlContent: string,
    isHtml = true,
  ): Promise<boolean> {
    try {
      const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');
      const fromName = this.configService.get<string>(
        'MAIL_FROM_NAME',
        'Aces Certifications',
      );

      const safeFromAddress =
        fromAddress ||
        `no-reply@${this.configService.get<string>('APP_DOMAIN', 'localhost')}`;
      const mailOptions = {
        from: `"${fromName}" <${safeFromAddress}>`,
        to: email,
        subject: subject,
        [isHtml ? 'html' : 'text']: htmlContent,
      };

      const info = await this.sendWithRetry(mailOptions);
      console.log(
        'Email sent successfully:',
        info.messageId ?? 'no-message-id',
      );
      return true;
    } catch (error) {
      console.error('Failed to send email after retries:', error);
      throw new BadRequestException(
        'Failed to send email. Please try again later.',
      );
    }
  }

  verifyConnection(): boolean {
    return this.isConfigured;
  }
}
