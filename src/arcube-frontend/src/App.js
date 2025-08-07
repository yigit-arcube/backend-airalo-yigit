import { useState, useEffect } from 'react';
import './App.css';

export default function ArcubeApp() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  // Profile management state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const debugToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('FULL TOKEN PAYLOAD:', payload);
      console.log('Available fields:', Object.keys(payload));
      return payload;
    } catch (error) {
      console.error('Token decode error:', error);
      return null;
    }
  };

  // login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // signup form
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    isPartner: false,
    invitationCode: ''
  });

  // available products for order creation - expanded to include all ancillary services
  const [availableProducts] = useState([
    // eSIM Products (Airalo)
    {
      id: 'esim-usa-5gb',
      title: 'eSIM USA - 5GB 30 Days',
      type: 'esim',
      provider: 'airalo',
      price: { amount: 22, currency: 'USD' },
      description: 'High-speed data for United States',
      features: ['5GB Data', '30 Days Validity', 'Instant Activation'],
      category: 'connectivity'
    },
    {
      id: 'esim-europe-10gb',
      title: 'eSIM Europe - 10GB 15 Days',
      type: 'esim',
      provider: 'airalo',
      price: { amount: 35, currency: 'USD' },
      description: 'Coverage across 30+ European countries',
      features: ['10GB Data', '15 Days Validity', 'Multi-country'],
      category: 'connectivity'
    },
    {
      id: 'esim-global-3gb',
      title: 'eSIM Global - 3GB 7 Days',
      type: 'esim',
      provider: 'airalo',
      price: { amount: 18, currency: 'USD' },
      description: 'Works in 100+ countries worldwide',
      features: ['3GB Data', '7 Days Validity', 'Global Coverage'],
      category: 'connectivity'
    },
    
    // Airport Transfer Services (Mozio)
    {
      id: 'transfer-jfk-manhattan',
      title: 'JFK Airport Transfer to Manhattan',
      type: 'airport_transfer',
      provider: 'mozio',
      price: { amount: 85, currency: 'USD' },
      description: 'Premium sedan transfer from JFK Airport',
      features: ['Meet & Greet', '4 Passengers', 'Flight Tracking', '24/7 Support'],
      category: 'transport'
    },
    {
      id: 'transfer-lax-downtown',
      title: 'LAX Airport Transfer to Downtown LA',
      type: 'airport_transfer',
      provider: 'mozio',
      price: { amount: 75, currency: 'USD' },
      description: 'Comfortable ride from LAX to city center',
      features: ['Professional Driver', '3 Passengers', 'Free Waiting', 'Fixed Price'],
      category: 'transport'
    },
    {
      id: 'transfer-lhr-central',
      title: 'Heathrow Transfer to Central London',
      type: 'airport_transfer',
      provider: 'mozio',
      price: { amount: 95, currency: 'USD' },
      description: 'Direct transfer from LHR to London city',
      features: ['Executive Vehicle', '4 Passengers', 'Flight Monitor', 'English Speaking'],
      category: 'transport'
    },
    
    // Lounge Access (DragonPass)
    {
      id: 'lounge-jfk-centurion',
      title: 'JFK Centurion Lounge Access',
      type: 'lounge_access',
      provider: 'dragonpass',
      price: { amount: 45, currency: 'USD' },
      description: 'Premium lounge access at JFK Terminal 4',
      features: ['3 Hours Access', 'Food & Drinks', 'WiFi & Showers', 'Business Center'],
      category: 'comfort'
    },
    {
      id: 'lounge-lax-star-alliance',
      title: 'LAX Star Alliance Lounge',
      type: 'lounge_access',
      provider: 'dragonpass',
      price: { amount: 55, currency: 'USD' },
      description: 'Star Alliance lounge at LAX Terminal 2',
      features: ['4 Hours Access', 'Premium Dining', 'Quiet Zones', 'City Views'],
      category: 'comfort'
    },
    {
      id: 'lounge-lhr-plaza-premium',
      title: 'Heathrow Plaza Premium Lounge',
      type: 'lounge_access',
      provider: 'dragonpass',
      price: { amount: 65, currency: 'USD' },
      description: 'Plaza Premium Lounge at Heathrow T5',
      features: ['5 Hours Access', 'Spa Services', 'Meeting Rooms', 'Kids Area'],
      category: 'comfort'
    },
    {
      id: 'lounge-dxb-emirates',
      title: 'Dubai Emirates Business Lounge',
      type: 'lounge_access',
      provider: 'dragonpass',
      price: { amount: 85, currency: 'USD' },
      description: 'Luxury Emirates lounge at Dubai International',
      features: ['6 Hours Access', 'A la carte Dining', 'Cigar Bar', 'Shower Suites'],
      category: 'comfort'
    }
  ]);

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productFilter, setProductFilter] = useState('all');

  // customer orders
  const [customerOrders, setCustomerOrders] = useState([]);

  // admin data
  const [adminStats, setAdminStats] = useState({});
  const [webhooks, setWebhooks] = useState([]);
  const [invitationCode, setInvitationCode] = useState('');

  // partner data
  const [partnerStats, setPartnerStats] = useState([]);
  const [partnerOrders, setPartnerOrders] = useState([]);

  // partner manual status update
  const [partnerStatusData, setPartnerStatusData] = useState({
    orderId: '',
    productId: '',
    newStatus: 'success'
  });

  const API_BASE = 'http://localhost:3000';

  // check if user is logged in on mount
  useEffect(() => {
    if (token) {
      try {
        const payload = debugToken(token);
        
        if (!payload) {
          handleLogout();
          return;
        }
        
        const userRole = payload.role || payload.userRole || payload.type || 'customer';
        const userId = payload.userId || payload.id || payload.sub || payload.user_id;
        const userEmail = payload.email || payload.user_email;
        
        console.log('Extracted values:', {
          role: userRole,
          userId: userId,
          email: userEmail
        });
        
        setUser({
          email: userEmail,
          role: userRole,
          userId: userId,
          firstName: payload.firstName || payload.first_name,
          lastName: payload.lastName || payload.last_name
        });
        
        console.log('Setting view for role:', userRole);
        if (userRole === 'admin') {
          setCurrentView('admin-dashboard');
        } else if (userRole === 'partner') {
          setCurrentView('partner-dashboard');
        } else {
          setCurrentView('my-orders');
        }
      } catch (error) {
        console.error('Invalid token:', error);
        handleLogout();
      }
    }
  }, [token]);

  // clear messages
  const clearMessages = () => {
    setResponse('');
    setError('');
  };

  // load user profile
  const loadUserProfile = async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const result = await res.json();
        const userData = result.data;
        setProfileData(userData);
        setProfileForm({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          newEmail: userData.email || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  // update profile handler
  const handleUpdateProfile = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      // Validate form
      if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
        setError('New passwords do not match');
        setLoading(false);
        return;
      }

      if (profileForm.newPassword && !profileForm.currentPassword) {
        setError('Current password required to change password');
        setLoading(false);
        return;
      }

      const updateData = {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        newEmail: profileForm.newEmail !== profileData.email ? profileForm.newEmail : undefined,
        currentPassword: profileForm.currentPassword || undefined,
        newPassword: profileForm.newPassword || undefined
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });
      
      const result = await res.json();
      
      if (result.success) {
        setResponse('Profile updated successfully!');
        
        // Update user state if email changed
        if (profileForm.newEmail !== profileData.email) {
          setUser(prev => ({
            ...prev,
            email: profileForm.newEmail
          }));
        }
        
        // Update user state with new name
        setUser(prev => ({
          ...prev,
          firstName: profileForm.firstName,
          lastName: profileForm.lastName
        }));
        
        // Reload profile data
        loadUserProfile();
        
        // Clear password fields
        setProfileForm(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
        
      } else {
        setError(result.error || 'Profile update failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // login handler
  const handleLogin = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      
      const result = await res.json();
      console.log('Login response:', result);
      
      if (result.success) {
        const token = result.data.token;
        const userData = result.data.user;
        
        console.log('User data from login:', userData);
        
        const tokenPayload = debugToken(token);
        console.log('Token payload vs user data:', {
          tokenPayload,
          userData
        });
        
        setToken(token);
        localStorage.setItem('token', token);
        
        const finalUser = {
          email: userData.email || tokenPayload.email,
          role: userData.role || tokenPayload.role || 'customer',
          userId: userData.userId || userData._id || userData.id || tokenPayload.userId,
          firstName: userData.firstName,
          lastName: userData.lastName
        };
        
        console.log('Final user object:', finalUser);
        setUser(finalUser);
        
        if (finalUser.role === 'admin') {
          setCurrentView('admin-dashboard');
        } else if (finalUser.role === 'partner') {
          setCurrentView('partner-dashboard');
        } else {
          setCurrentView('my-orders');
        }
        
        setResponse(`Welcome back, ${finalUser.firstName || finalUser.email}!`);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // signup handler
  const handleSignup = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
      });
      
      const result = await res.json();
      
      if (result.success) {
        setResponse(result.data.message);
        if (signupData.isPartner) {
          setResponse(`${result.data.message}\nYour API Key: ${result.data.apiKey}`);
        }
        setCurrentView('login');
        setSignupData({
          email: '', password: '', firstName: '', lastName: '', 
          isPartner: false, invitationCode: ''
        });
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // handle product selection (toggle)
  const handleProductToggle = (product) => {
    setSelectedProducts(prev => {
      const isSelected = prev.some(p => p.id === product.id);
      if (isSelected) {
        return prev.filter(p => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  // clear all selected products
  const clearSelectedProducts = () => {
    setSelectedProducts([]);
  };

  // filter products based on selected category
  const filteredProducts = productFilter === 'all' 
    ? availableProducts 
    : availableProducts.filter(product => product.category === productFilter);

  // create order handler - updated to handle multiple products
  const handleCreateOrder = async () => {
    if (selectedProducts.length === 0 || !user) {
      setError('Please select at least one product and ensure you are logged in');
      return;
    }

    setLoading(true);
    clearMessages();
    
    try {
      const orderData = {
        customer: {
          email: user.email,
          firstName: user.firstName || 'Customer',
          lastName: user.lastName || 'User'
        },
        products: selectedProducts
      };

      const res = await fetch(`${API_BASE}/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });
      
      const result = await res.json();
      
      if (result.success) {
        const productCount = selectedProducts.length;
        const totalAmount = selectedProducts.reduce((sum, p) => sum + p.price.amount, 0);
        setResponse(`Order created successfully! PNR: ${result.data.pnr} (${productCount} product${productCount > 1 ? 's' : ''}, Total: $${totalAmount})`);
        setSelectedProducts([]);
        loadCustomerOrders();
      } else {
        setError(result.error || 'Order creation failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // activate eSIM handler
  const handleActivateEsim = async (orderId, productId) => {
    setLoading(true);
    clearMessages();
    
    try {
      const res = await fetch(`${API_BASE}/orders/activate-esim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId, productId })
      });
      
      const result = await res.json();
      
      if (result.success) {
        setResponse('eSIM activated successfully!');
        loadCustomerOrders();
      } else {
        setError(result.user_message || result.error || 'Activation failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // cancel order handler
  const handleCancelOrder = async (order, productId) => {
    setLoading(true);
    clearMessages();
    
    try {
      const payload = {
        orderIdentifier: {
          pnr: order.pnr,
          orderId: order._id,
          ...(user.role === 'customer' && { email: order.customer.email })
        },
        productId: productId,
        requestSource: user.role === 'admin' ? 'admin_panel' : 
                     user.role === 'partner' ? 'partner_api' : 'customer_app',
        reason: 'Customer requested cancellation'
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const res = await fetch(`${API_BASE}/orders/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      
      if (result.success) {
        const refundMsg = result.data.refundAmount > 0 ? 
          ` Refund: $${result.data.refundAmount}` : ' No refund available';
        setResponse(`Cancellation successful!${refundMsg}`);
        
        if (user.role === 'customer') loadCustomerOrders();
        if (user.role === 'admin') loadAdminData();
        if (user.role === 'partner') loadPartnerData();
      } else {
        setError(result.user_message || result.error || 'Cancellation failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // bulk cancel order handler
  const handleBulkCancelOrder = async (order) => {
    const cancellableProducts = order.products.filter(p => 
      p.simStatus !== 'active' && 
      p.status !== 'cancelled' && 
      p.status !== 'failed' && 
      p.status !== 'denied'
    );

    if (cancellableProducts.length === 0) {
      setError('No products available for cancellation in this order');
      return;
    }

    setLoading(true);
    clearMessages();
    
    try {
      const payload = {
        orderIdentifier: {
          pnr: order.pnr,
          orderId: order._id,
          ...(user.role === 'customer' && { email: order.customer.email })
        },
        productIds: cancellableProducts.map(p => p.id),
        requestSource: user.role === 'admin' ? 'admin_panel' : 
                     user.role === 'partner' ? 'partner_api' : 'customer_app',
        reason: 'Customer requested bulk cancellation'
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const res = await fetch(`${API_BASE}/orders/bulk-cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      
      if (result.success) {
        const { successful, failed, summary } = result.data;
        const totalRefund = summary?.totalRefund || 0;
        setResponse(`Bulk cancellation completed! ${successful}/${successful + failed} successful. Total refund: $${totalRefund}`);
        loadCustomerOrders();
      } else {
        setError(result.error || 'Bulk cancellation failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // partner manual status update
  const handleUpdateProductStatus = async () => {
    if (!partnerStatusData.orderId || !partnerStatusData.productId) {
      setError('Order ID and Product ID are required');
      return;
    }

    setLoading(true);
    clearMessages();
    
    try {
      const res = await fetch(`${API_BASE}/orders/partner/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: partnerStatusData.orderId,
          productId: partnerStatusData.productId,
          status: partnerStatusData.newStatus
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        setResponse(`Product status updated to ${partnerStatusData.newStatus}`);
        setPartnerStatusData({ orderId: '', productId: '', newStatus: 'success' });
        loadPartnerData();
      } else {
        setError(result.error || 'Status update failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // load customer orders
  const loadCustomerOrders = async () => {
    if (!token || user?.role !== 'customer') return;
    
    try {
      const res = await fetch(`${API_BASE}/orders/customer/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const result = await res.json();
        setCustomerOrders(result.data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load customer orders:', error);
    }
  };

  // load admin data
  const loadAdminData = async () => {
    if (!token || user?.role !== 'admin') return;
    
    try {
      const [statsRes, webhooksRes] = await Promise.all([
        fetch(`${API_BASE}/orders/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/webhooks/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setAdminStats(stats.data || {});
      }
      
      if (webhooksRes.ok) {
        const webhookData = await webhooksRes.json();
        setWebhooks(webhookData.data.webhooks || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  // load partner data
  const loadPartnerData = async () => {
    if (!token || user?.role !== 'partner') return;
    
    try {
      const res = await fetch(`${API_BASE}/orders/partner/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const result = await res.json();
        setPartnerStats(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load partner data:', error);
    }
  };

  // create invitation code (admin only)
  const handleCreateInvitation = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const res = await fetch(`${API_BASE}/auth/admin/create-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await res.json();
      
      if (result.success) {
        setInvitationCode(result.data.invitationCode);
        setResponse(`Invitation code created: ${result.data.invitationCode}`);
      } else {
        setError(result.error || 'Failed to create invitation code');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // load data when user changes
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') loadCustomerOrders();
      if (user.role === 'admin') loadAdminData();
      if (user.role === 'partner') loadPartnerData();
      loadUserProfile(); // Load profile data
    }
  }, [user]);

  // logout handler
  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('token');
    setCurrentView('login');
    setResponse('Logged out successfully');
    
    setCustomerOrders([]); // clearing out all the variables to logout securely
    setAdminStats({});
    setWebhooks([]);
    setPartnerStats([]);
    setInvitationCode('');
    setSelectedProducts([]);
    setProfileData({ firstName: '', lastName: '', email: '' });
    setProfileForm({ firstName: '', lastName: '', newEmail: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  // navigation handler
  const navigate = (view) => {
    setCurrentView(view);
    clearMessages();
  };

  // get status badge class
  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'status-success';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      case 'denied': return 'status-denied';
      case 'cancelled': return 'status-cancelled';
      case 'active': return 'status-active';
      default: return 'status-default';
    }
  };

  // get order summary info
  const getOrderSummary = (products) => {
    const totalAmount = products.reduce((sum, p) => sum + p.price.amount, 0);
    const activeCount = products.filter(p => p.simStatus === 'active').length;
    const cancelledCount = products.filter(p => p.status === 'cancelled').length;
    
    return { totalAmount, activeCount, cancelledCount, totalCount: products.length };
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Arcube Ancillaries Service</h1>
          
          {user && (
            <div className="user-info">
              <span className={`role-badge role-${user.role}`}>{user.role}</span>
              <span className="user-email">{user.email}</span>
              <button onClick={handleLogout} className="btn btn-logout">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="container">
        {!user ? (
          <div className="auth-container">
            <div className="auth-tabs">
              <button 
                className={`tab ${currentView === 'login' ? 'active' : ''}`}
                onClick={() => navigate('login')}
              >
                Login
              </button>
              <button 
                className={`tab ${currentView === 'signup' ? 'active' : ''}`}
                onClick={() => navigate('signup')}
              >
                Sign Up
              </button>
            </div>

            {currentView === 'login' && (
              <div className="auth-form">
                <h2>Welcome Back</h2>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>PNR</label>
                  <input
                    type="password"
                    placeholder="Enter your PNR"
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleLogin} 
                  disabled={loading}
                  className="btn btn-primary btn-full"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            )}

            {currentView === 'signup' && (
              <div className="auth-form">
                <h2>Create Account</h2>
                
                <div className="partner-toggle">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={signupData.isPartner}
                      onChange={(e) => setSignupData({...signupData, isPartner: e.target.checked})}
                    />
                    <span className="checkmark"></span>
                    Partner Account
                  </label>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      placeholder="First name"
                      value={signupData.firstName}
                      onChange={(e) => setSignupData({...signupData, firstName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      placeholder="Last name"
                      value={signupData.lastName}
                      onChange={(e) => setSignupData({...signupData, lastName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={signupData.email}
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                 />
               </div>

               <div className="form-group">
                 <label>Password</label>
                 <input
                   type="password"
                   placeholder="Enter your PNR code"
                   value={signupData.password}
                   onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                 />
               </div>

               {signupData.isPartner && (
                 <div className="form-group partner-invite">
                   <label>Invitation Code</label>
                   <input
                     type="text"
                     placeholder="Enter invitation code"
                     value={signupData.invitationCode}
                     onChange={(e) => setSignupData({...signupData, invitationCode: e.target.value})}
                   />
                   <small>Required for partner registration</small>
                 </div>
               )}

               <button 
                 onClick={handleSignup} 
                 disabled={loading}
                 className="btn btn-success btn-full"
               >
                 {loading ? 'Creating Account...' : 'Create Account'}
               </button>
             </div>
           )}
         </div>
       ) : (
         <div className="main-content">
           <nav className="sidebar">
             {user.role === 'customer' && (
               <>
                 <button 
                   className={`nav-btn ${currentView === 'my-orders' ? 'active' : ''}`}
                   onClick={() => navigate('my-orders')}
                 >
                   My Orders
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'create-order' ? 'active' : ''}`}
                   onClick={() => navigate('create-order')}
                 >
                   Buy Ancillaries
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
                   onClick={() => navigate('profile')}
                 >
                   Profile Settings
                 </button>
               </>
             )}
             
             {user.role === 'admin' && (
               <>
                 <button 
                   className={`nav-btn ${currentView === 'admin-dashboard' ? 'active' : ''}`}
                   onClick={() => navigate('admin-dashboard')}
                 >
                   Dashboard
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'admin-invitations' ? 'active' : ''}`}
                   onClick={() => navigate('admin-invitations')}
                 >
                   Invitations
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'admin-webhooks' ? 'active' : ''}`}
                   onClick={() => navigate('admin-webhooks')}
                 >
                   Webhooks
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
                   onClick={() => navigate('profile')}
                 >
                   Profile Settings
                 </button>
               </>
             )}

             {user.role === 'partner' && (
               <>
                 <button 
                   className={`nav-btn ${currentView === 'partner-dashboard' ? 'active' : ''}`}
                   onClick={() => navigate('partner-dashboard')}
                 >
                   Dashboard
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'partner-orders' ? 'active' : ''}`}
                   onClick={() => navigate('partner-orders')}
                 >
                   Manage Orders
                 </button>
                 <button 
                   className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
                   onClick={() => navigate('profile')}
                 >
                   Profile Settings
                 </button>
               </>
             )}
           </nav>

           <div className="content-area">
             {/* Customer Views */}
             {currentView === 'my-orders' && user.role === 'customer' && (
               <div className="section">
                 <h2>My Orders</h2>
                 {customerOrders.length === 0 ? (
                   <div className="empty-state">
                     <p>No orders yet. Get your first travel services!</p>
                     <button 
                       onClick={() => navigate('create-order')}
                       className="btn btn-primary"
                     >
                       Buy Services
                     </button>
                   </div>
                 ) : (
                   <div className="orders-grid">
                     {customerOrders.map((order) => {
                       const summary = getOrderSummary(order.products);
                       return (
                         <div key={order._id} className="order-card">
                           <div className="order-header">
                             <div className="order-header-main">
                               <h3>PNR: {order.pnr}</h3>
                               <span className="order-date">
                                 {new Date(order.createdAt).toLocaleDateString()}
                               </span>
                             </div>
                             <div className="order-summary-badges">
                               <span className="summary-badge">
                                 {summary.totalCount} product{summary.totalCount > 1 ? 's' : ''}
                               </span>
                               <span className="summary-badge total-amount">
                                 Total: ${summary.totalAmount}
                               </span>
                               {summary.activeCount > 0 && (
                                 <span className="summary-badge active-count">
                                   {summary.activeCount} active
                                 </span>
                               )}
                               {summary.cancelledCount > 0 && (
                                 <span className="summary-badge cancelled-count">
                                   {summary.cancelledCount} cancelled
                                 </span>
                               )}
                             </div>
                           </div>
                           
                           {/* Bulk actions for orders with multiple products */}
                           {order.products.length > 1 && (
                             <div className="bulk-actions">
                               <button 
                                 onClick={() => handleBulkCancelOrder(order)}
                                 className="btn btn-sm btn-warning"
                                 disabled={loading || order.products.filter(p => 
                                   p.simStatus !== 'active' && 
                                   p.status !== 'cancelled' && 
                                   p.status !== 'failed' && 
                                   p.status !== 'denied'
                                 ).length === 0}
                               >
                                 Cancel All Available Products
                               </button>
                             </div>
                           )}

                           {order.products.map((product) => (
                             <div key={product.id} className="product-item">
                               <div className="product-info">
                                 <h4>{product.title}</h4>
                                 <p className="price">${product.price.amount}</p>
                                 <div className="status-row">
                                   <span className={`status-badge ${getStatusClass(product.status)}`}>
                                     Payment: {product.status}
                                   </span>
                                   {product.simStatus && product.provider === 'airalo' && (
                                     <span className={`status-badge ${getStatusClass(product.simStatus)}`}>
                                       eSIM: {product.simStatus.replace('_', ' ')}
                                     </span>
                                   )}
                                 </div>
                                 {product.status === 'pending' && (
                                   <div className="pending-info">
                                     <small>Processing payment... (up to 15 seconds)</small>
                                   </div>
                                 )}
                               </div>
                               <div className="product-actions">
                                 {/* Activate button - show only for successful products with ready eSIM */}
                                 {product.simStatus === 'ready_for_activation' && product.status === 'success' && product.provider === 'airalo' && (
                                   <button 
                                     onClick={() => handleActivateEsim(order._id, product.id)}
                                     className="btn btn-sm btn-success"
                                     disabled={loading}
                                   >
                                     Activate eSIM
                                   </button>
                                 )}
                                 
                                 {/* Cancel button - show for non-activated and non-cancelled products */}
                                 {product.simStatus !== 'active' && product.status !== 'cancelled' && product.status !== 'failed' && product.status !== 'denied' && (
                                   <button 
                                     onClick={() => handleCancelOrder(order, product.id)}
                                     className="btn btn-sm btn-danger"
                                     disabled={loading}
                                   >
                                     Cancel & Refund
                                   </button>
                                 )}
                                 
                                 {/* Status messages */}
                                 {product.simStatus === 'active' && (
                                   <div className="status-message success">
                                     <small>eSIM is active and ready to use!</small>
                                   </div>
                                 )}
                                 
                                 {product.status === 'failed' && (
                                   <div className="status-message error">
                                     <small>Payment failed. Contact support.</small>
                                   </div>
                                 )}
                                 
                                 {product.status === 'denied' && (
                                   <div className="status-message warning">
                                     <small>Order denied due to compliance.</small>
                                   </div>
                                 )}
                                 
                                 {product.status === 'cancelled' && (
                                   <div className="status-message neutral">
                                     <small>Order cancelled. Refund processing...</small>
                                   </div>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
             )}

             {currentView === 'create-order' && user.role === 'customer' && (
               <div className="section">
                 <h2>Buy Travel Services</h2>
                 
                 {/* Product Category Filter */}
                 <div className="product-filters">
                   <div className="filter-tabs">
                     <button 
                       className={`filter-tab ${productFilter === 'all' ? 'active' : ''}`}
                       onClick={() => setProductFilter('all')}
                     >
                       All Services ({availableProducts.length})
                     </button>
                     <button 
                       className={`filter-tab ${productFilter === 'connectivity' ? 'active' : ''}`}
                       onClick={() => setProductFilter('connectivity')}
                     >
                       eSIM & Data ({availableProducts.filter(p => p.category === 'connectivity').length})
                     </button>
                     <button 
                       className={`filter-tab ${productFilter === 'transport' ? 'active' : ''}`}
                       onClick={() => setProductFilter('transport')}
                     >
                       Airport Transfers ({availableProducts.filter(p => p.category === 'transport').length})
                     </button>
                     <button 
                       className={`filter-tab ${productFilter === 'comfort' ? 'active' : ''}`}
                       onClick={() => setProductFilter('comfort')}
                     >
                       Lounge Access ({availableProducts.filter(p => p.category === 'comfort').length})
                     </button>
                   </div>
                 </div>
                 
                 {/* Selection Summary */}
                 {selectedProducts.length > 0 && (
                   <div className="selection-summary">
                     <div className="selection-header">
                       <h3>{selectedProducts.length} service{selectedProducts.length > 1 ? 's' : ''} selected</h3>
                       <button onClick={clearSelectedProducts} className="btn btn-sm btn-secondary">
                         Clear All
                       </button>
                     </div>
                     <div className="selected-products">
                       {selectedProducts.map(product => (
                         <div key={product.id} className="selected-product-tag">
                           <span>{product.title} - ${product.price.amount}</span>
                           <button 
                             onClick={() => handleProductToggle(product)}
                             className="remove-product"
                           >
                             ×
                           </button>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 <div className="products-grid">
                   {filteredProducts.map((product) => (
                     <div 
                       key={product.id} 
                       className={`product-selection-card ${selectedProducts.some(p => p.id === product.id) ? 'selected' : ''}`}
                       onClick={() => handleProductToggle(product)}
                     >
                       <div className="product-provider-badge">
                         {product.provider}
                       </div>
                       <h3>{product.title}</h3>
                       <p className="product-description">{product.description}</p>
                       <div className="product-features">
                         {product.features.map((feature, index) => (
                           <span key={index} className="feature-tag">{feature}</span>
                         ))}
                       </div>
                       <div className="product-price-large">
                         ${product.price.amount} {product.price.currency}
                       </div>
                       {selectedProducts.some(p => p.id === product.id) && (
                         <div className="selected-indicator">
                           ✓ Selected
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
                 
                 {selectedProducts.length > 0 && (
                   <div className="order-summary">
                     <h3>Order Summary</h3>
                     <div className="summary-items">
                       {selectedProducts.map(product => (
                         <div key={product.id} className="summary-item">
                           <span>{product.title}</span>
                           <span>${product.price.amount} {product.price.currency}</span>
                         </div>
                       ))}
                     </div>
                     <div className="summary-divider"></div>
                     <div className="summary-item summary-total">
                       <span>Total ({selectedProducts.length} service{selectedProducts.length > 1 ? 's' : ''}):</span>
                       <span>${selectedProducts.reduce((sum, p) => sum + p.price.amount, 0)} USD</span>
                     </div>
                     <div className="summary-item">
                       <span>Customer:</span>
                       <span>{user.email}</span>
                     </div>
                     
                     <button 
                       onClick={handleCreateOrder}
                       disabled={loading}
                       className="btn btn-primary btn-full order-btn"
                     >
                       {loading ? 'Processing Order...' : 
                        `Buy ${selectedProducts.length > 1 ? 'All' : 'Now'} - $${selectedProducts.reduce((sum, p) => sum + p.price.amount, 0)}`}
                     </button>
                   </div>
                 )}
               </div>
             )}

             {/* Admin Views */}
             {currentView === 'admin-dashboard' && user.role === 'admin' && (
               <div className="section">
                 <h2>Admin Dashboard</h2>
                 <div className="stats-grid">
                   <div className="stat-card">
                     <h3>Total Orders</h3>
                     <div className="stat-number">{adminStats.totalOrders || 0}</div>
                   </div>
                   <div className="stat-card">
                     <h3>Active Products</h3>
                     <div className="stat-number">{adminStats.successProducts || 0}</div>
                   </div>
                   <div className="stat-card">
                     <h3>Cancelled Products</h3>
                     <div className="stat-number">{adminStats.cancelledProducts || 0}</div>
                   </div>
                   <div className="stat-card">
                     <h3>Total Revenue</h3>
                     <div className="stat-number">${adminStats.totalRevenue || 0}</div>
                   </div>
                   <div className="stat-card">
                     <h3>Activated eSIMs</h3>
                     <div className="stat-number">{adminStats.activatedEsims || 0}</div>
                   </div>
                   <div className="stat-card">
                     <h3>Pending Orders</h3>
                     <div className="stat-number">{adminStats.pendingProducts || 0}</div>
                   </div>
                 </div>
               </div>
             )}

             {currentView === 'admin-invitations' && user.role === 'admin' && (
               <div className="section">
                 <h2>Partner Invitations</h2>
                 <div className="form-card">
                   <h3>Create Invitation Code</h3>
                   <p>Generate invitation codes for new partners</p>
                   
                   <button 
                     onClick={handleCreateInvitation}
                     disabled={loading}
                     className="btn btn-primary btn-full"
                   >
                     {loading ? 'Creating Code...' : 'Generate New Invitation Code'}
                   </button>
                   
                   {invitationCode && (
                     <div className="invitation-result">
                       <h4>New Invitation Code:</h4>
                       <div className="code-display">
                         <code>{invitationCode}</code>
                         <button 
                           onClick={() => navigator.clipboard.writeText(invitationCode)}
                           className="btn btn-sm btn-secondary"
                         >
                           Copy
                         </button>
                       </div>
                       <small>Valid for 30 days</small>
                     </div>
                   )}
                 </div>
               </div>
             )}
             
             {currentView === 'admin-webhooks' && user.role === 'admin' && (
               <div className="section">
                 <h2>Webhook Management</h2>
                 <div className="webhooks-list">
                   {webhooks.length === 0 ? (
                     <div className="empty-state">
                       <p>No webhooks configured</p>
                     </div>
                   ) : (
                     webhooks.map((webhook) => (
                       <div key={webhook.id} className="webhook-card">
                         <div className="webhook-info">
                           <h4>{webhook.url}</h4>
                           <p>Events: {webhook.events.join(', ')}</p>
                           <span className={`status-badge ${webhook.isActive ? 'status-active' : 'status-inactive'}`}>
                             {webhook.isActive ? 'Active' : 'Inactive'}
                           </span>
                         </div>
                         <div className="webhook-date">
                           {new Date(webhook.createdAt).toLocaleDateString()}
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               </div>
             )}

             {/* Partner Views */}
             {currentView === 'partner-dashboard' && user.role === 'partner' && (
               <div className="section">
                 <h2>Partner Dashboard</h2>
                 <div className="stats-grid">
                   {partnerStats.statusStats && partnerStats.statusStats.map((stat, index) => (
                     <div key={index} className="stat-card">
                       <h3>Status: {stat._id}</h3>
                       <div className="stat-number">{stat.count}</div>
                       <div className="stat-detail">Total: ${stat.totalAmount}</div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {currentView === 'partner-orders' && user.role === 'partner' && (
               <div className="section">
                 <h2>Order Management</h2>
                 
                 <div className="form-card">
                   <h3>Manual Status Update</h3>
                   <p>Update order status manually (within 15 seconds of creation)</p>
                   
                   <div className="form-row">
                     <div className="form-group">
                       <label>Order ID</label>
                       <input
                         type="text"
                         placeholder="Order ID (MongoDB ObjectId)"
                         value={partnerStatusData.orderId}
                         onChange={(e) => setPartnerStatusData({...partnerStatusData, orderId: e.target.value})}
                       />
                     </div>
                     <div className="form-group">
                       <label>Product ID</label>
                       <input
                         type="text"
                         placeholder="Product ID (e.g., PROD-001)"
                         value={partnerStatusData.productId}
                         onChange={(e) => setPartnerStatusData({...partnerStatusData, productId: e.target.value})}
                       />
                     </div>
                   </div>
                   
                   <div className="form-group">
                     <label>New Status</label>
                     <select 
                       value={partnerStatusData.newStatus}
                       onChange={(e) => setPartnerStatusData({...partnerStatusData, newStatus: e.target.value})}
                     >
                       <option value="success">Success</option>
                       <option value="failed">Failed</option>
                       <option value="denied">Denied</option>
                       <option value="cancelled">Cancelled</option>
                     </select>
                   </div>
                   
                   <button 
                     onClick={handleUpdateProductStatus}
                     disabled={loading || !partnerStatusData.orderId}
                     className="btn btn-warning btn-full"
                   >
                     {loading ? 'Updating...' : 'Update Status'}
                   </button>
                 </div>
               </div>
             )}

             {/* Profile View */}
             {currentView === 'profile' && (
               <div className="section">
                 <h2>Profile Settings</h2>
                 
                 <div className="form-card">
                   <h3>Personal Information</h3>
                   <p>Update your account details</p>
                   
                   <div className="form-row">
                     <div className="form-group">
                       <label>First Name</label>
                       <input
                         type="text"
                         placeholder="Enter first name"
                         value={profileForm.firstName}
                         onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                       />
                     </div>
                     <div className="form-group">
                       <label>Last Name</label>
                       <input
                         type="text"
                         placeholder="Enter last name"
                         value={profileForm.lastName}
                         onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                       />
                     </div>
                   </div>
                   
                   <div className="form-group">
                     <label>Email Address</label>
                     <input
                       type="email"
                       placeholder="Enter email address"
                       value={profileForm.newEmail}
                       onChange={(e) => setProfileForm({...profileForm, newEmail: e.target.value})}
                     />
                     <small>Used for login and notifications</small>
                   </div>
                 </div>

                 <div className="form-card">
                   <h3>Change Password (PNR)</h3>
                   <p>Update your login password</p>
                   
                   <div className="form-group">
                     <label>Current Password</label>
                     <input
                       type="password"
                       placeholder="Enter current password"
                       value={profileForm.currentPassword}
                       onChange={(e) => setProfileForm({...profileForm, currentPassword: e.target.value})}
                     />
                     <small>Required to change password</small>
                   </div>
                   
                   <div className="form-row">
                     <div className="form-group">
                       <label>New Password</label>
                       <input
                         type="password"
                         placeholder="Enter new password"
                         value={profileForm.newPassword}
                         onChange={(e) => setProfileForm({...profileForm, newPassword: e.target.value})}
                       />
                     </div>
                     <div className="form-group">
                       <label>Confirm New Password</label>
                       <input
                         type="password"
                         placeholder="Confirm new password"
                         value={profileForm.confirmPassword}
                         onChange={(e) => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                       />
                     </div>
                   </div>
                 </div>

                 <div className="profile-actions">
                   <button 
                     onClick={handleUpdateProfile}
                     disabled={loading}
                     className="btn btn-primary"
                   >
                     {loading ? 'Updating Profile...' : 'Save Changes'}
                   </button>
                   
                   <button 
                     onClick={loadUserProfile}
                     disabled={loading}
                     className="btn btn-secondary"
                   >
                     Reset Form
                   </button>
                 </div>

                 <div className="profile-info">
                   <h4>Account Information</h4>
                   <div className="info-grid">
                     <div className="info-item">
                       <span className="info-label">Account Type:</span>
                       <span className={`role-badge role-${user.role}`}>{user.role}</span>
                     </div>
                     <div className="info-item">
                       <span className="info-label">Member Since:</span>
                       <span>{profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'N/A'}</span>
                     </div>
                     {user.role === 'partner' && (
                       <div className="info-item">
                         <span className="info-label">API Access:</span>
                         <span className="status-badge status-active">Enabled</span>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             )}

             {/* Response/Error Messages */}
             {(response || error) && (
               <div className="message-section">
                 {response && (
                   <div className="message success">
                     <div className="message-content">
                       <strong>Success:</strong> {response}
                     </div>
                     <button 
                       onClick={() => setResponse('')} 
                       className="message-close"
                     >
                       ×
                     </button>
                   </div>
                 )}
                 
                 {error && (
                   <div className="message error">
                     <div className="message-content">
                       <strong>Error:</strong> {error}
                     </div>
                     <button 
                       onClick={() => setError('')} 
                       className="message-close"
                     >
                       ×
                     </button>
                   </div>
                 )}
               </div>
             )}
           </div>
         </div>
       )}
     </div>
   </div>
 );
}