import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { EmailService } from '../../../common/services/email.service';
import { NotificationPayload } from '../types/notification.types';

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);

  constructor(private readonly emailService: EmailService) {}

  async sendNotificationEmail(
    to: string,
    payload: NotificationPayload,
  ): Promise<void> {
    try {
      const subject = payload.title;
      const html = this.buildHtmlBody(payload);
      await this.emailService.sendEmail(to, subject, html);
      this.logger.debug(`Notification email sent to ${to}: ${payload.title}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification email to ${to}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private loadTemplate(fallback: string): string {
    try {
      const distPath = path.join(
        process.cwd(),
        'dist',
        'templates',
        'notification-email.html',
      );
      if (fs.existsSync(distPath)) {
        return fs.readFileSync(distPath, 'utf8');
      }

      const isProduction =
        process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
      if (!isProduction) {
        const srcPath = path.join(
          process.cwd(),
          'src',
          'templates',
          'notification-email.html',
        );
        if (fs.existsSync(srcPath)) {
          return fs.readFileSync(srcPath, 'utf8');
        }
      }

      return fallback;
    } catch {
      return fallback;
    }
  }

  private buildHtmlBody(payload: NotificationPayload): string {
    const moduleLabel = this.getModuleLabel(payload.module, payload.type);
    const priorityColor = this.getPriorityColor(payload.priority);
    const priorityColorBg = `${priorityColor}15`;
    const actionButton = payload.actionUrl
      ? `<tr><td style="padding:8px 32px 0;">
           <div style="margin-top:24px;text-align:center;">
             <a href="${payload.actionUrl}"
                style="background:#1a56db;color:#fff;padding:12px 28px;border-radius:6px;
                       text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
               View Details
             </a>
           </div>
         </td></tr>`
      : '';

    const htmlMessage = this.formatMessageHtml(payload.message, payload.metadata);
    const fallback = this.buildFallbackHtml(
      payload.title,
      htmlMessage,
      moduleLabel,
      priorityColor,
      priorityColorBg,
      actionButton,
    );

    let html = this.loadTemplate(fallback);

    if (html.includes('{{')) {
      html = html
        .replace(/{{\s*TITLE\s*}}/g, payload.title)
        .replace(/{{\s*MESSAGE\s*}}/g, htmlMessage)
        .replace(/{{\s*MODULE_LABEL\s*}}/g, moduleLabel)
        .replace(/{{\s*PRIORITY_COLOR\s*}}/g, priorityColor)
        .replace(/{{\s*PRIORITY_COLOR_BG\s*}}/g, priorityColorBg)
        .replace(/{{\s*ACTION_BUTTON\s*}}/g, actionButton);
    }

    return html;
  }

  private buildFallbackHtml(
    title: string,
    message: string,
    moduleLabel: string,
    priorityColor: string,
    priorityColorBg: string,
    actionButton: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <tr>
            <td style="background:#1a56db;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px;">
                ACES Certification
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">
                Platform Notification
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <span style="background:${priorityColorBg};color:${priorityColor};
                           padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">
                ${moduleLabel}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <h2 style="margin:0 0 10px;font-size:20px;color:#111827;line-height:1.3;">
                ${title}
              </h2>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                ${message}
              </p>
            </td>
          </tr>
          ${actionButton}
          <tr>
            <td style="padding:32px;border-top:1px solid #e5e7eb;margin-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                This notification was sent by the ACES Certification platform.<br />
                You can manage your notification preferences in your account settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Formats the message for HTML emails.
   * If metadata contains question context (from compliance actions),
   * renders a structured card with question details.
   * Otherwise, converts newlines to <br> tags.
   */
  private formatMessageHtml(
    message: string,
    metadata?: Record<string, unknown>,
  ): string {
    if (metadata?.questionText && metadata?.sectionPath && metadata?.action) {
      const sectionPath = String(metadata.sectionPath);
      const questionText = String(metadata.questionText);
      const answerText = String(metadata.answerText || 'No answer provided');
      const action = String(metadata.action);

      const actionLabels: Record<string, string> = {
        request_clarification: 'Clarification Requested',
        non_compliant: 'Non-Compliant',
        compliant: 'Compliant',
      };
      const actionColors: Record<string, string> = {
        request_clarification: '#f97316',
        non_compliant: '#ef4444',
        compliant: '#10b981',
      };
      const actionLabel = actionLabels[action] || action;
      const actionColor = actionColors[action] || '#6b7280';

      // Extract auditor's note from the message (last line after "Auditor's Note: ")
      const noteMatch = message.match(/Auditor's Note:\s*(.+)$/s);
      const auditorNote = noteMatch ? noteMatch[1].trim() : message;

      return `
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;letter-spacing:0.5px;">
                Status
              </p>
              <p style="margin:4px 0 0;font-size:14px;color:${actionColor};font-weight:600;">${actionLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;letter-spacing:0.5px;">
                Section
              </p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827;">${sectionPath}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;letter-spacing:0.5px;">
                Question
              </p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:500;">${questionText}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;letter-spacing:0.5px;">
                Applicant's Answer
              </p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827;">${answerText}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;color:${actionColor};font-weight:600;letter-spacing:0.5px;">
                Auditor's Note
              </p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827;font-style:italic;">${auditorNote}</p>
            </td>
          </tr>
        </table>`;
    }

    // Default: convert newlines to <br>
    return message.replace(/\n/g, '<br>');
  }

  private getModuleLabel(module?: string, type?: string): string {
    if (!module) return 'Notification';
    const labels: Record<string, string> = {
      assessment: 'Assessment',
      ai_review: 'AI Review',
      audit: 'Audit',
      payment: 'Payment',
      certificate: 'Certificate',
      system: 'System',
    };
    const typeHints: Record<string, string> = {
      new_audit_assigned: 'New Audit Assigned',
      audit_deadline: 'Deadline Reminder',
      review_submission: 'Review Submitted',
      new_review_assigned: 'New Review Assigned',
      review_deadline: 'Deadline Reminder',
    };
    return typeHints[type ?? ''] ?? labels[module] ?? 'Notification';
  }

  private getPriorityColor(priority?: string): string {
    switch (priority) {
      case 'urgent':
        return '#ef4444';
      case 'high':
        return '#f97316';
      case 'low':
        return '#6b7280';
      default:
        return '#1a56db';
    }
  }
}
