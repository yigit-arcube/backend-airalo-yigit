import crypto from 'crypto';

export class EncryptionService {
  private algorithm: string = 'aes-256-gcm';
  private secretKey: Buffer;

  constructor() {
    // use environment variable or generate a consistent key for demo
    const secret = process.env.ENCRYPTION_SECRET || 'arcube-demo-secret-key-32-chars!!';
    this.secretKey = crypto.scryptSync(secret, 'salt', 32);
  }

  // encrypt sensitive data like PII and payment information -- protects customer data in database
  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.secretKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

// decrypt sensitive data for processing and display -- recovers customer data when needed
decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.secretKey, iv);
    
    let decrypted: string = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('decryption failed:', error);
    throw new Error('failed to decrypt data');
  }
}

  // hash sensitive data for comparison without storing original -- useful for API keys and passwords
  hash(text: string): string {
    try {
      return crypto
        .createHash('sha256')
        .update(text)
        .digest('hex');
    } catch (error) {
      console.error('Hashing failed:', error);
      throw new Error('Failed to hash data');
    }
  }

  // generate secure random tokens for API keys and secrets -- creates cryptographically secure tokens
  generateSecureToken(length: number = 32): string {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      console.error('Token generation failed:', error);
      throw new Error('Failed to generate secure token');
    }
  }

  // encrypt customer email for JWT token -- probably going to be used within the link sent to the customer after their flight to securely make their purchases for ancessilieries
  encryptForJWT(email: string, userId: string): string {
    try {
      const payload = JSON.stringify({ email, userId, timestamp: Date.now() });
      return this.encrypt(payload);
    } catch (error) {
      console.error('JWT encryption failed:', error);
      throw new Error('Failed to encrypt JWT payload');
    }
  }

  // decrypt customer data from JWT token, double check with the server with our own encryptions
  decryptFromJWT(encryptedPayload: string): { email: string; userId: string } {
    try {
      const decrypted = this.decrypt(encryptedPayload);
      const parsed = JSON.parse(decrypted);
      
      return {
        email: parsed.email,
        userId: parsed.userId
      };
    } catch (error) {
      console.error('JWT decryption failed:', error);
      throw new Error('Failed to decrypt JWT payload');
    }
  }

  // anonymize PII data for logging compliance -- removes sensitive data for audit logs
  anonymizePII(data: any): any {
    try {
      const anonymized = JSON.parse(JSON.stringify(data));
      
      // Anonymize common PII fields
      if (anonymized.customer?.email) {
        const emailParts = anonymized.customer.email.split('@');
        anonymized.customer.email = emailParts[0].substring(0, 2) + '***@' + emailParts[1];
      }
      
      if (anonymized.customer?.firstName) {
        anonymized.customer.firstName = anonymized.customer.firstName.charAt(0) + '***';
      }
      
      if (anonymized.customer?.lastName) {
        anonymized.customer.lastName = anonymized.customer.lastName.charAt(0) + '***';
      }

      // remove sensitive metadata
      if (anonymized.products) {
        anonymized.products.forEach((product: any) => {
          if (product.metadata) {
            delete product.metadata.iccid;
            delete product.metadata.qrCode;
            delete product.metadata.confirmationNumber;
          }
        });
      }

      return anonymized;
    } catch (error) {
      console.error('PII anonymization failed:', error);
      return { error: 'Failed to anonymize data' };
    }
  }

  // // generate HMAC -- ensures data hasn't been tampered with
  // generateHMAC(data: string, secret?: string): string {
  //   try {
  //     const key = secret || this.secretKey.toString('hex');
  //     return crypto
  //       .createHmac('sha256', key)
  //       .update(data)
  //       .digest('hex');
  //   } catch (error) {
  //     console.error('HMAC generation failed:', error);
  //     throw new Error('Failed to generate HMAC');
  //   }
  // }

  // // verify HMAC integrity -- validates data integrity
  // verifyHMAC(data: string, signature: string, secret?: string): boolean {
  //   try {
  //     const expectedSignature = this.generateHMAC(data, secret);
  //     return crypto.timingSafeEqual(
  //       Buffer.from(signature, 'hex'),
  //       Buffer.from(expectedSignature, 'hex')
  //     );
  //   } catch (error) {
  //     console.error('HMAC verification failed:', error);
  //     return false;
  //   }
  // }
}
