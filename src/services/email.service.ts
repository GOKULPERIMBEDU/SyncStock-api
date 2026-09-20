import nodemailer from 'nodemailer';
import { env } from '../config/env';
import type { IProductDocument } from '../models/Product.model';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (!env.smtp.host || !env.smtp.user || env.smtp.host.includes('<LEAVE_BLANK_FOR_ME>')) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });
    }

    return this.transporter;
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.warn(`[email] SMTP not configured. Password reset link: ${resetUrl}`);
      return;
    }

    await transporter.sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      subject: 'SyncStock password reset',
      text: `Reset your SyncStock password using this link (valid 30 minutes):\n${resetUrl}`,
      html: `<p>Reset your SyncStock password using this link (valid 30 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  async sendLowStockAlert(product: IProductDocument): Promise<void> {
    const transporter = this.getTransporter();
    const to = env.alertReceiverEmail;

    if (!transporter || !to || to.includes('<LEAVE_BLANK_FOR_ME>')) {
      console.warn(
        `[email] SMTP not configured. Skipped low-stock alert for ${product.sku} (${product.currentStock} remaining).`
      );
      return;
    }

    await transporter.sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      subject: `SyncStock alert: ${product.name} is low on stock`,
      text: [
        `Product: ${product.name}`,
        `SKU: ${product.sku}`,
        `Category: ${product.category}`,
        `Current stock: ${product.currentStock}`,
        `Low-stock threshold: ${product.lowStockThreshold}`,
        '',
        'Restock this item before warehouse operations are blocked.',
      ].join('\n'),
      html: `
        <h2>Low stock alert</h2>
        <p><strong>${product.name}</strong> has dropped to or below its threshold.</p>
        <ul>
          <li>SKU: ${product.sku}</li>
          <li>Category: ${product.category}</li>
          <li>Current stock: <strong>${product.currentStock}</strong></li>
          <li>Threshold: ${product.lowStockThreshold}</li>
        </ul>
        <p>Restock this item before warehouse operations are blocked.</p>
      `,
    });
  }
}

export const emailService = new EmailService();
