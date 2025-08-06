import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repos/userRepo';
import { EncryptionService } from '../services/encryptionService';
import { InvitationService } from '../services/invitationService';
import { createRateLimit, authenticateJWT, authorize } from '../auth/auth';

const router = Router();
const userRepo = new UserRepository();
const encryptionService = new EncryptionService();
const invitationService = new InvitationService();

// rate limit for auth endpoints to prevent brute force attacks
const authRateLimit = createRateLimit(15 * 1000, 5); // 5 attempts per 15 seconds for testing

// unified signup endpoint for customers and partners
router.post('/signup', authRateLimit, async (req, res) => {
  try {
    const { email, password, firstName, lastName, isPartner, invitationCode } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'email, password, firstName, and lastName required'
      });
    }

    // check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'user with this email already exists'
      });
    }

    let userRole = 'customer';
    let userData: any = {
      email,
      password,
      firstName,
      lastName,
      role: userRole
    };

    // handle partner registration
    if (isPartner) {
      if (!invitationCode) {
        return res.status(400).json({
          success: false,
          error: 'invitation code required for partner registration'
        });
      }

      // validate invitation code
      const invitationValidation = await invitationService.validateInvitationCode(invitationCode);
      if (!invitationValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'invalid or expired invitation code'
        });
      }

      // generate API key for partner
      const apiKey = encryptionService.generateSecureToken(32);
      
      userRole = 'partner';
      userData = {
        ...userData,
        role: 'partner',
        apiKey,
        invitationCode,
        invitedBy: invitationValidation.createdBy
      };

      // mark invitation as used
      await invitationService.markInvitationAsUsed(invitationCode, email);
    }

    const user = await userRepo.createUser(userData);

    console.log(`${userRole} registered: ${email}`);

    // prepare response based on user type
    const responseData: any = {
      message: `${userRole} account created successfully`,
      user: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };

    // include API key for partners
    if (userRole === 'partner') {
      responseData.apiKey = userData.apiKey;
    }

    res.status(201).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('signup failed:', error);
    res.status(500).json({
      success: false,
      error: 'registration failed'
    });
  }
});

// unified login endpoint
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'email and password required'
      });
    }

    // find user and validate credentials
    const user = await userRepo.findByEmail(email);
    if (!user || !await userRepo.validatePassword(user, password)) {
      return res.status(401).json({
        success: false,
        error: 'invalid credentials'
      });
    }

    // generate jwt token
    const tokenPayload = {
      email: user.email,
      userId: user._id.toString(),
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const tokenExpiry = user.role === 'admin' ? '8h' : '24h';
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', {
      expiresIn: tokenExpiry
    });

    console.log(`user logged in: ${email} with role: ${user.role}`);

    const responseData: any = {
      token,
      user: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };

    // include API key for partners
    if (user.role === 'partner' && user.apiKey) {
      responseData.apiKey = user.apiKey;
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('login failed:', error);
    res.status(500).json({
      success: false,
      error: 'login failed'
    });
  }
});

// admin creates invitation codes for partner registration
router.post('/admin/create-invitation', 
  authRateLimit,
  authenticateJWT, 
  authorize(['admin']), 
  async (req, res) => {
    try {
      const adminId = req.user.id;
      
      const invitationCode = await invitationService.generateInvitationCode(adminId);

      console.log(`invitation code created by admin ${req.user.email}: ${invitationCode}`);

      res.json({
        success: true,
        data: {
          invitationCode,
          message: 'invitation code created successfully',
          validFor: '30 days'
        }
      });

    } catch (error) {
      console.error('invitation code creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'failed to create invitation code'
      });
    }
  }
);

// admin gets all invitation codes
router.get('/admin/invitations', 
  authenticateJWT, 
  authorize(['admin']), 
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const invitations = await invitationService.getInvitationsByAdmin(adminId);

      res.json({
        success: true,
        data: {
          invitations,
          count: invitations.length
        }
      });

    } catch (error) {
      console.error('failed to get invitations:', error);
      res.status(500).json({
        success: false,
        error: 'failed to retrieve invitations'
      });
    }
  }
);

// validate invitation code (for frontend)
router.post('/validate-invitation', authRateLimit, async (req, res) => {
  try {
    const { invitationCode } = req.body;

    if (!invitationCode) {
      return res.status(400).json({
        success: false,
        error: 'invitation code required'
      });
    }

    const validation = await invitationService.validateInvitationCode(invitationCode);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        message: validation.valid ? 'invitation code is valid' : 'invitation code is invalid or expired'
      }
    });

  } catch (error) {
    console.error('invitation validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'validation failed'
    });
  }
});

export default router;