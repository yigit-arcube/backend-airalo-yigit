import { useState, useEffect } from 'react';
import './App.css';

export default function ArcubeApp() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

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

  // available products for order creation
  const [availableProducts] = useState([
    {
      id: 'esim-usa-5gb',
      title: 'eSIM USA - 5GB 30 Days',
      type: 'esim',
      price: { amount: 22, currency: 'USD' },
      description: 'High-speed data for United States',
      features: ['5GB Data', '30 Days Validity', 'Instant Activation']
    },
    {
      id: 'esim-europe-10gb',
      title: 'eSIM Europe - 10GB 15 Days',
      type: 'esim',
      price: { amount: 35, currency: 'USD' },
      description: 'Coverage across 30+ European countries',
      features: ['10GB Data', '15 Days Validity', 'Multi-country']
    },
    {
      id: 'esim-global-3gb',
      title: 'eSIM Global - 3GB 7 Days',
      type: 'esim',
      price: { amount: 18, currency: 'USD' },
      description: 'Works in 100+ countries worldwide',
      features: ['3GB Data', '7 Days Validity', 'Global Coverage']
    },
    //new ancilleries to be added
  ]);

  const [selectedProduct, setSelectedProduct] = useState(null);

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
      const payload = debugToken(token); // Use the debug function first
      
      if (!payload) {
        handleLogout();
        return;
      }
      
      // Try different possible role field names
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
      
      // Set initial view based on role
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
      
      // Debug the token immediately after successful login
      const tokenPayload = debugToken(token);
      console.log('Token payload vs user data:', {
        tokenPayload,
        userData
      });
      
      setToken(token);
      localStorage.setItem('token', token);
      
      // Use the user data from the response, not just the token
      const finalUser = {
        email: userData.email || tokenPayload.email,
        role: userData.role || tokenPayload.role || 'customer',
        userId: userData.userId || userData._id || userData.id || tokenPayload.userId,
        firstName: userData.firstName,
        lastName: userData.lastName
      };
      
      console.log('Final user object:', finalUser);
      setUser(finalUser);
      
      // Navigate based on the confirmed role
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

  // create order handler - simplified to use user data and selected product
  const handleCreateOrder = async () => {
    if (!selectedProduct || !user) {
      setError('Please select a product and ensure you are logged in');
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
        products: [selectedProduct]
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
        setResponse(`Order created successfully! PNR: ${result.data.pnr}`);
        setSelectedProduct(null);
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
        
        // reload relevant data
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
    }
  }, [user]);

  // logout handler
  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('token');
    setCurrentView('login');
    setResponse('Logged out successfully');
    
    // clear all data
    setCustomerOrders([]);
    setAdminStats({});
    setWebhooks([]);
    setPartnerStats([]);
    setInvitationCode('');
    setSelectedProduct(null);
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Arcube eSIM Service</h1>
          
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
          // Authentication Views
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
          // Main Application
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
                    Buy Ancelleires
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
                      <p>No orders yet. Get your amazing Ancelleires!</p>
                      <button 
                        onClick={() => navigate('create-order')}
                        className="btn btn-primary"
                      >
                        Buy ancillaries
                      </button>
                    </div>
                  ) : (
                    <div className="orders-grid">
                      {customerOrders.map((order) => (
                        <div key={order._id} className="order-card">
                          <div className="order-header">
                            <h3>PNR: {order.pnr}</h3>
                            <span className="order-date">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {order.products.map((product) => (
                            <div key={product.id} className="product-item">
                              <div className="product-info">
                                <h4>{product.title}</h4>
                                <p className="price">${product.price.amount}</p>
                                <div className="status-row">
                                  <span className={`status-badge ${getStatusClass(product.status)}`}>
                                    Payment: {product.status}
                                  </span>
                                  {product.simStatus && (
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
                                {product.simStatus === 'ready_for_activation' && product.status === 'success' && (
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
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentView === 'create-order' && user.role === 'customer' && (
                <div className="section">
                  <h2>Buy eSIM</h2>
                  <div className="products-grid">
                    {availableProducts.map((product) => (
                      <div 
                        key={product.id} 
                        className={`product-selection-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                        onClick={() => setSelectedProduct(product)}
                      >
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
                        {selectedProduct?.id === product.id && (
                          <div className="selected-indicator">Selected</div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {selectedProduct && (
                    <div className="order-summary">
                      <h3>Order Summary</h3>
                      <div className="summary-item">
                        <span>Product:</span>
                        <span>{selectedProduct.title}</span>
                      </div>
                      <div className="summary-item">
                        <span>Price:</span>
                        <span>${selectedProduct.price.amount} {selectedProduct.price.currency}</span>
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
                        {loading ? 'Processing Order...' : `Buy Now - $${selectedProduct.price.amount}`}
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
                    {partnerStats.map((stat, index) => (
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