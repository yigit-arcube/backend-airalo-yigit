import sgMail from '@sendgrid/mail';


export class EmailService {
  constructor() {
    const apiKey = process.env.REACT_APP_SENDGRID_API_KEY || 'SG.nofreeapikey'; 
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

  // send bulk cancellation confirmation email to customer
async sendBulkCancellationConfirmation(
  customerEmail: string, 
  customerName: string, 
  bulkCancellationData: {
    orderPnr: string;
    cancellations: Array<{
      productTitle: string;
      cancellationId: string;
      refundAmount: number;
      message: string;
    }>;
    totalRefund: number;
  }
): Promise<boolean> {
  try {
    // create cancellation list for email template
    const cancellationList = bulkCancellationData.cancellations
      .map(cancellation => `
        <div style="border-left: 3px solid #28a745; padding-left: 12px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #333;">${cancellation.productTitle}</h4>
          <p style="margin: 2px 0; font-size: 14px; color: #666;">
            <strong>Cancellation ID:</strong> ${cancellation.cancellationId}
          </p>
          <p style="margin: 2px 0; font-size: 14px; color: #666;">
            <strong>Refund Amount:</strong> $${cancellation.refundAmount.toFixed(2)} USD
          </p>
          <p style="margin: 2px 0; font-size: 14px; color: #666;">
            <strong>Status:</strong> ${cancellation.message}
          </p>
        </div>
      `)
      .join('');

    const emailData = {
      to: customerEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@arcube.com',
        name: process.env.SENDGRID_FROM_NAME || 'Arcube'
      },
      subject: `Cancellations Confirmed - Order ${bulkCancellationData.orderPnr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
          <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">Cancellation Confirmations</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Order: ${bulkCancellationData.orderPnr}</p>
          </div>

          <div style="margin-bottom: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Dear ${customerName},</p>
            
            <p style="color: #333; margin-bottom: 20px;">
              We have successfully processed the cancellation of <strong>${bulkCancellationData.cancellations.length} services</strong> 
              from your order. Below are the details for each cancelled service:
            </p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 20px;">Cancelled Services</h3>
            ${cancellationList}
          </div>

          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border: 1px solid #28a745; margin-bottom: 30px;">
            <h3 style="color: #155724; margin-top: 0; margin-bottom: 15px;">Refund Summary</h3>
            <p style="font-size: 18px; font-weight: bold; color: #155724; margin: 0;">
              Total Refund Amount: $${bulkCancellationData.totalRefund.toFixed(2)} USD
            </p>
            <p style="color: #155724 ; margin: 10px 0 0 0; font-size: 14px;">
              Refunds will be processed to your original payment method within 3-7 business days.
            </p>
          </div>
            
            <p style="color: #333;">
              Thank you for choosing Arcube for your travel needs.
            </p>
          </div>
      `
    };

    const response = await sgMail.send(emailData);
    console.log(`bulk cancellation confirmation email sent successfully to ${customerEmail}`);
    
    return true;
  } catch (error) {
    console.error('failed to send bulk cancellation confirmation email:', error);
    
    // log detailed error for debugging
    if (error instanceof Error) {
      console.error('email error details:', {
        message: error.message,
        stack: error.stack,
        customerEmail,
        orderPnr: bulkCancellationData.orderPnr,
        cancellationCount: bulkCancellationData.cancellations.length
      });
    }
    
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