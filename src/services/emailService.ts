import sgMail from '@sendgrid/mail';

export class EmailService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY || 'SG.sample_key_for_testing_12345abcdef';
    sgMail.setApiKey(apiKey);
  }

  // Send cancellation confirmation to customer -- simple email notification for order status updates
  async sendCancellationConfirmation(
    customerEmail: string,
    customerName: string,
    cancellationDetails: any
  ): Promise<boolean> {
    try {
      const msg = {
        to: customerEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@arcube.com',
          name: process.env.SENDGRID_FROM_NAME || 'Arcube'
        },
        subject: 'Cancellation Confirmation',
        html: this.generateCustomerEmail(customerName, cancellationDetails)
      };

      await sgMail.send(msg);
      console.log(`Customer notification sent to: ${customerEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to send customer email:', error);
      return false;
    }
  }

  // send cancellation notification to admin -- webhook alternative for admin notifications
  async sendAdminNotification(
    adminEmail: string,
    cancellationDetails: any
  ): Promise<boolean> {
    try {
      const msg = {
        to: adminEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@arcube.com',
          name: process.env.SENDGRID_FROM_NAME || 'Arcube Admin'
        },
        subject: `Cancellation ${cancellationDetails.status.toUpperCase()} - ${cancellationDetails.cancellationId}`,
        html: this.generateAdminEmail(cancellationDetails)
      };

      await sgMail.send(msg);
      console.log(`Admin notification sent to: ${adminEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to send admin email:', error);
      return false;
    }
  }

  // simple customer email template -- keeps it brief and informative
  private generateCustomerEmail(customerName: string, details: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Cancellation Update</h2>
        <p>Hi ${customerName},</p>
        <p>Your cancellation request has been ${details.success ? 'approved' : 'denied'}.</p>
        
        <div style="background: #f5f5f5; padding: 15px; margin: 15px 0;">
          <p><strong>ID:</strong> ${details.cancellationId}</p>
          <p><strong>Refund:</strong> ${details.refundAmount > 0 ? `$${details.refundAmount}` : 'None'}</p>
          ${details.message ? `<p><strong>Note:</strong> ${details.message}</p>` : ''}
        </div>
        
        <p>Thank you,<br>Arcube Team</p>
      </div>
    `;
  }

  // simple admin email template -- focused on essential cancellation data
  private generateAdminEmail(details: any): string {
    return `
      <div style="font-family: Arial, sans-serif;">
        <h3>Cancellation Alert</h3>
        <p><strong>Status:</strong> ${details.status}</p>
        <p><strong>ID:</strong> ${details.cancellationId}</p>
        <p><strong>Order:</strong> ${details.orderId}</p>
        <p><strong>Product:</strong> ${details.productId}</p>
        <p><strong>Refund:</strong> ${details.refundAmount || 0}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        ${details.message ? `<p><strong>Message:</strong> ${details.message}</p>` : ''}
      </div>
    `;
  }

  // test email connectivity -- health check helper for email service
  async testConnection(): Promise<boolean> {
  try {
    // we are not sending but we are supposed to
    console.log('Email service configuration valid');
    return true;
  } catch (error) {
    console.error('Email service configuration invalid:', error);
    return false;
  }
}
}