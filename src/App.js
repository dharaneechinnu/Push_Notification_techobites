import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logo from './Assets/logo.webp';

const API_URL = 'http://192.168.29.242:3500';

function App() {
  const [view, setView] = useState('login'); // login, register, dashboard, admin
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [notification, setNotification] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin state
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [allStudents, setAllStudents] = useState([]);

  useEffect(() => {
    if (token) {
      setView('dashboard');

      // Check if already subscribed to notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          setSwRegistration(registration);
          registration.pushManager.getSubscription().then(subscription => {
            setIsSubscribed(!!subscription);
          });
        });
      }
    }

    // Fetch students list (for admin panel)
    if (view === 'admin') {
      fetchStudents();
    }
  }, [token, view]);

  useEffect(() => {
    // Register the service worker only once
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
          setSwRegistration(registration);
          
          // Check if the user is logged in and pass studentId to the service worker
          if (studentId) {
            sendStudentIdToServiceWorker(studentId);
          }
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
      
      // Set up message handler for communication with the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from service worker:', event.data);
        
        if (event.data.type === 'GET_STUDENT_ID') {
          console.log('Service worker requested studentId, sending:', studentId);
          event.ports[0].postMessage({ studentId: studentId });
        }
      });
    }

    // Request notification permission only once
    requestNotificationPermission();
  }, []);

  // Send studentId to service worker whenever it changes
  useEffect(() => {
    if (studentId && 'serviceWorker' in navigator) {
      sendStudentIdToServiceWorker(studentId);
    }
  }, [studentId]);

  const sendStudentIdToServiceWorker = (id) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      console.log('Sending studentId to service worker:', id);
      
      // Create a message channel to get a response
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log('Service worker confirmed receipt of studentId');
        }
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'STORE_STUDENT_ID', studentId: id },
        [messageChannel.port2]
      );
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted.');
      } else {
        console.log('Notification permission denied.');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_URL}/students`);
      setAllStudents(response.data);
    } catch (error) {
      showNotification('Error fetching students', 'error');
    }
  };

  const subscribeUserToPush = async () => {
    try {
      // Use existing registration or wait for service worker to be ready
      let registration = swRegistration;
      
      if (!registration && 'serviceWorker' in navigator) {
        registration = await navigator.serviceWorker.ready;
        console.log('Using existing service worker registration:', registration);
      } else if (!registration) {
        showNotification('Service Worker is not supported in this browser.', 'error');
        return;
      }
  
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Already subscribed:', existingSubscription);
        setIsSubscribed(true);
        
        // Send subscription to server
        await axios.post(`${API_URL}/subscribe`, {
          studentId,
          subscription: existingSubscription
        });
        
        showNotification('Subscription refreshed successfully!', 'success');
        return;
      }
  
      // Get VAPID public key from server
      const response = await axios.get(`${API_URL}/vapidPublicKey`);
      const vapidPublicKey = response.data.publicKey;
      
      if (!vapidPublicKey) {
        showNotification('Failed to get public key from server', 'error');
        return;
      }
      
      console.log('Received public key:', vapidPublicKey);
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
  
      // Ensure the student ID is passed to the service worker
      sendStudentIdToServiceWorker(studentId);
      
      // Subscribe the user
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
  
      console.log('New subscription created:', subscription);
  
      // Send subscription to server
      await axios.post(`${API_URL}/subscribe`, {
        studentId,
        subscription: subscription
      });
  
      setIsSubscribed(true);
      showNotification('Notification subscription successful!', 'success');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      showNotification(`Failed to subscribe: ${error.message}`, 'error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/register`, { studentId, password });
      showNotification('Registration successful! Please login.', 'success');
      setView('login');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Registration failed', 'error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/login`, { studentId, password });
      const { token } = response.data;
      localStorage.setItem('token', token);
      setToken(token);
      setView('dashboard');
      
      // After successful login, store the studentId in the service worker
      if ('serviceWorker' in navigator) {
        sendStudentIdToServiceWorker(studentId);
      }
      
      showNotification('Login successful!', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Login failed', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setStudentId('');
    setPassword('');
    setView('login');
    setMenuOpen(false);
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      showNotification('Please select at least one student', 'error');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/sendNotification`, {
        studentIds: selectedStudents,
        title: notificationTitle,
        message: notificationMessage
      });

      if (res.status === 200) {
        showNotification('Notifications sent successfully!', 'success');
        setNotificationTitle('');
        setNotificationMessage('');
        setSelectedStudents([]);
      } else {
        showNotification('Something went wrong. Please try again.', 'error');
      }
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to send notifications', 'error');
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const toggleStudentSelection = (id) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(s => s !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
  const testNotification = () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }
    
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification('Test Notification', {
            body: 'This is a test notification',
            icon: '/notification.png',
            vibrate: [100, 50, 100],
            requireInteraction: true
          });
        });
      } else {
        alert('Notification permission was denied');
      }
    });
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <div className="app">
      <style>
        {`
          :root {
            --primary-color: #4361ee;
            --secondary-color: #3f37c9;
            --accent-color: #4895ef;
            --text-primary: #333333;
            --text-secondary: #666666;
            --background-primary: #ffffff;
            --background-secondary: #f8f9fa;
            --background-tertiary: #e9ecef;
            --success-color: #0cce6b;
            --warning-color: #ff9e00;
            --error-color: #e63946;
            --border-radius: 8px;
            --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            --transition: all 0.3s ease;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
              Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          }

          body {
            background-color: var(--background-secondary);
            color: var(--text-primary);
            line-height: 1.6;
            font-size: 16px;
          }

          .app {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }

          /* Header Styles */
          .header {
            background-color: var(--background-primary);
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
          }

          .logo-container {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .logo {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--primary-color);
            display: flex;
            align-items: center;
          }

          .logo-icon {
            margin-right: 10px;
            width: 30px;
          }

          .menu-icon {
            display: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--primary-color);
          }

          .nav {
            display: flex;
            gap: 1.5rem;
            align-items: center;
          }

          /* Main Container */
          .main-container {
            flex: 1;
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
          }

          /* Card Styles */
          .card {
            background-color: var(--background-primary);
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            padding: 2rem;
            margin-bottom: 2rem;
            transition: var(--transition);
          }

          .card:hover {
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          }

          .card-header {
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--background-tertiary);
          }

          .card-title {
            font-size: 1.5rem;
            color: var(--primary-color);
            margin-bottom: 0.5rem;
            font-weight: 600;
          }

          /* Form Styles */
          .form-container {
            max-width: 450px;
            margin: 0 auto;
          }

          .form-group {
            margin-bottom: 1.5rem;
          }

          .form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: var(--text-primary);
          }

          .form-input {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid var(--background-tertiary);
            border-radius: var(--border-radius);
            font-size: 1rem;
            transition: var(--transition);
            background-color: var(--background-primary);
          }

          .form-input:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.15);
          }

          .form-textarea {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid var(--background-tertiary);
            border-radius: var(--border-radius);
            min-height: 120px;
            resize: vertical;
            font-size: 1rem;
            transition: var(--transition);
            font-family: inherit;
          }

          .form-textarea:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.15);
          }

          /* Button Styles */
          .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: var(--border-radius);
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }

          .btn-icon {
            font-size: 1.2rem;
          }

          .btn-primary {
            background-color: var(--primary-color);
            color: white;
          }

          .btn-primary:hover {
            background-color: var(--secondary-color);
            transform: translateY(-2px);
          }

          .btn-secondary {
            background-color: var(--background-tertiary);
            color: var(--text-primary);
          }

          .btn-secondary:hover {
            background-color: #dcdfe2;
            transform: translateY(-2px);
          }

          .btn-success {
            background-color: var(--success-color);
            color: white;
          }

          .btn-success:hover {
            background-color: #0ab15d;
            transform: translateY(-2px);
          }

          .btn-outline {
            background-color: transparent;
            border: 1px solid var(--primary-color);
            color: var(--primary-color);
          }

          .btn-outline:hover {
            background-color: var(--primary-color);
            color: white;
            transform: translateY(-2px);
          }

          .btn-link {
            background: none;
            color: var(--primary-color);
            padding: 0.5rem;
            text-decoration: underline;
            font-weight: 500;
          }

          .btn-link:hover {
            color: var(--secondary-color);
            text-decoration: none;
          }
          
          .btn-logout {
            background-color: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--background-tertiary);
          }

          .btn-logout:hover {
            background-color: var(--background-tertiary);
            color: var(--text-primary);
          }

          .btn-full {
            width: 100%;
          }

          /* Grid Layout */
          .grid {
            display: grid;
            gap: 2rem;
          }

          .grid-2 {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid-3 {
            grid-template-columns: repeat(3, 1fr);
          }

          /* Dashboard Styles */
          .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }

          .stat-card {
            padding: 1.5rem;
            border-radius: var(--border-radius);
            background-color: var(--background-primary);
            box-shadow: var(--box-shadow);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .stat-card-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background-color: rgba(67, 97, 238, 0.15);
            color: var(--primary-color);
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }

          .stat-card-title {
            font-size: 0.875rem;
            color: var(--text-secondary);
          }

          .stat-card-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
          }

          /* Notification Styles */
          .notification-container {
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 1000;
            max-width: 350px;
            width: calc(100% - 2rem);
          }

          .notification {
            padding: 1rem 1.5rem;
            border-radius: var(--border-radius);
            margin-bottom: 0.75rem;
            box-shadow: var(--box-shadow);
            display: flex;
            align-items: center;
            animation: slideIn 0.3s ease forwards;
          }

          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          .notification-info {
            background-color: var(--accent-color);
            color: white;
          }

          .notification-success {
            background-color: var(--success-color);
            color: white;
          }

          .notification-error {
            background-color: var(--error-color);
            color: white;
          }

          .notification-icon {
            margin-right: 0.75rem;
            font-size: 1.25rem;
          }

          /* Admin Panel Styles */
          .student-selection {
            margin-top: 1.5rem;
          }

          .student-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.75rem;
            max-height: 300px;
            overflow-y: auto;
            padding: 1rem;
            border: 1px solid var(--background-tertiary);
            border-radius: var(--border-radius);
            margin-bottom: 1rem;
          }

          .student-item {
            display: flex;
            align-items: center;
            padding: 0.5rem;
            border-radius: var(--border-radius);
            transition: var(--transition);
          }

          .student-item:hover {
            background-color: var(--background-tertiary);
          }

          .student-checkbox {
            margin-right: 0.75rem;
          }

          .selection-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
          }

          .feature-card {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 1.5rem;
            background-color: var(--background-primary);
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
          }

          .feature-card-icon {
            font-size: 2rem;
            color: var(--primary-color);
          }

          .feature-card-title {
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--text-primary);
          }

          .feature-card-text {
            color: var(--text-secondary);
          }

          .subscription-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            text-align: center;
            background-color: var(--background-primary);
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            margin-bottom: 2rem;
          }

          .subscription-icon {
            font-size: 3rem;
            color: var(--primary-color);
            margin-bottom: 1rem;
          }

          .subscription-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
          }

          .subscription-text {
            margin-bottom: 1.5rem;
            color: var(--text-secondary);
          }

          .subscribed-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--success-color);
            font-weight: 500;
          }

          .subscribed-icon {
            font-size: 1.5rem;
          }
          
          /* Mobile Responsive */
          @media (max-width: 768px) {
            .header {
              padding: 1rem;
            }
            
            .menu-icon {
              display: block;
            }
            
            .nav {
              position: fixed;
              top: 70px;
              right: 0;
              background-color: var(--background-primary);
              width: 250px;
              height: calc(100vh - 70px);
              flex-direction: column;
              padding: 2rem;
              box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
              transform: translateX(100%);
              transition: var(--transition);
            }
            
            .nav.open {
              transform: translateX(0);
            }
            
            .main-container {
              padding: 1rem;
            }
            
            .grid-2, .grid-3 {
              grid-template-columns: 1fr;
            }
            
            .card {
              padding: 1.5rem;
            }
            
            .student-list {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <img className="logo-icon" src={logo} alt="Logo" />
            Crescent
          </div>
        </div>
        
        {token && (
          <>
            <div className="menu-icon" onClick={toggleMenu}>
              ☰
            </div>
            <nav className={`nav ${menuOpen ? 'open' : ''}`}>
              <button 
                className="btn btn-logout" 
                onClick={handleLogout}
              >
                Logout
              </button>
            </nav>
          </>
        )}
      </header>

      {notification && (
        <div className="notification-container">
          <div className={`notification notification-${notification.type}`}>
            <span className="notification-icon">
              {notification.type === 'success' ? '✓' : 
               notification.type === 'error' ? '✕' : 'ℹ'}
            </span>
            {notification.message}
          </div>
        </div>
      )}

      <main className="main-container">
        {view === 'login' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Login to Your Account</h2>
              <p>Welcome back! Please enter your credentials to continue.</p>
            </div>
            <div className="form-container">
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label" htmlFor="studentId">Student ID</label>
                  <input 
                    id="studentId"
                    className="form-input" 
                    type="text" 
                    placeholder="Enter your student ID"
                    value={studentId} 
                    onChange={(e) => setStudentId(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <input 
                    id="password"
                    className="form-input" 
                    type="password" 
                    placeholder="Enter your password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full">
                  Login
                </button>
              </form>
              
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <p>Don't have an account?</p>
                <button 
                  onClick={() => setView('register')} 
                  className="btn btn-link"
                >
                  Register Now
                </button>
                <div style={{ marginTop: '1rem' }}>
                  <button 
                    onClick={() => setView('admin')} 
                    className="btn btn-link"
                  >
                    Access Admin Panel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'register' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Create New Account</h2>
              <p>Register to receive important notifications from your institution.</p>
            </div>
            <div className="form-container">
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label" htmlFor="regStudentId">Student ID</label>
                  <input 
                    id="regStudentId"
                    className="form-input" 
                    type="text" 
                    placeholder="Enter your student ID"
                    value={studentId} 
                    onChange={(e) => setStudentId(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="regPassword">Password</label>
                  <input 
                    id="regPassword"
                    className="form-input" 
                    type="password" 
                    placeholder="Create a password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full">
                  Register
                </button>
              </form>
              
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <p>Already have an account?</p>
                <button 
                  onClick={() => setView('login')} 
                  className="btn btn-link"
                >
                  Login Here
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <>
            <div className="card card-header">
              <h2 className="card-title">Welcome, Student {studentId}</h2>
              <p>Stay connected with important updates and announcements.</p>
            </div>
            
            <div className="subscription-card">
              <div className="subscription-icon">
                {isSubscribed ? '🔔' : '🔕'}
              </div>
              <h3 className="subscription-title">Notification Settings</h3>
              
              {!isSubscribed ? (
                <>
                  <p className="subscription-text">
                    Subscribe to receive important notifications about classes, exams, and events directly on your device.
                  </p>
                  <button onClick={subscribeUserToPush} className="btn btn-primary">
                    <span className="btn-icon">📲</span> Enable Notifications
                  </button>
                </>
              ) : (
                <div className="subscribed-indicator">
                  <span className="subscribed-icon">✓</span>
                  You're actively subscribed to notifications
                </div>
                )}
              
                <div style={{ marginTop: '1rem' }}>
                  <button onClick={testNotification} className="btn btn-secondary">
                    <span className="btn-icon">🔔</span> Test Notification
                  </button>
                </div>
              </div>
              
              <div className="grid grid-3">
                <div className="feature-card">
                  <div className="feature-card-icon">📝</div>
                  <h3 className="feature-card-title">Class Updates</h3>
                  <p className="feature-card-text">
                    Receive timely notifications about class schedule changes, assignments, and instructor announcements.
                  </p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-card-icon">📊</div>
                  <h3 className="feature-card-title">Exam Alerts</h3>
                  <p className="feature-card-text">
                    Never miss an exam with reminders about upcoming tests, submission deadlines, and result announcements.
                  </p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-card-icon">🎭</div>
                  <h3 className="feature-card-title">Campus Events</h3>
                  <p className="feature-card-text">
                    Stay informed about campus activities, workshops, seminars, and cultural events happening around you.
                  </p>
                </div>
              </div>
            </>
          )}
  
          {view === 'admin' && (
            <>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Admin Panel</h2>
                  <p>Send targeted notifications to students.</p>
                </div>
                
                <form onSubmit={handleSendNotification}>
                  <div className="form-group">
                    <label className="form-label">Notification Title</label>
                    <input 
                      className="form-input" 
                      type="text" 
                      placeholder="Enter notification title"
                      value={notificationTitle} 
                      onChange={(e) => setNotificationTitle(e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Notification Message</label>
                    <textarea 
                      className="form-textarea" 
                      placeholder="Enter your message"
                      value={notificationMessage} 
                      onChange={(e) => setNotificationMessage(e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Select Recipients</label>
                    <div className="selection-controls">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setSelectedStudents(allStudents.map(s => s.studentId))}
                      >
                        Select All
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setSelectedStudents([])}
                      >
                        Clear Selection
                      </button>
                    </div>
                    
                    <div className="student-list">
                      {allStudents.map(student => (
                        <div key={student.studentId} className="student-item">
                          <input 
                            type="checkbox" 
                            className="student-checkbox" 
                            id={`student-${student.studentId}`}
                            checked={selectedStudents.includes(student.studentId)} 
                            onChange={() => toggleStudentSelection(student.studentId)} 
                          />
                          <label htmlFor={`student-${student.studentId}`}>{student.studentId}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button type="submit" className="btn btn-primary">
                    <span className="btn-icon">📨</span> Send Notification
                  </button>
                </form>
                
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <button 
                    onClick={() => setView('login')} 
                    className="btn btn-link"
                  >
                    Back to Login
                  </button>
                </div>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Analytics Dashboard</h2>
                  <p>Overview of notifications and student engagement.</p>
                </div>
                
                <div className="stats-container">
                  <div className="stat-card">
                    <div className="stat-card-icon">👥</div>
                    <span className="stat-card-title">Total Students</span>
                    <span className="stat-card-value">{allStudents.length}</span>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-card-icon">🔔</div>
                    <span className="stat-card-title">Notifications Sent</span>
                    <span className="stat-card-value">24</span>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-card-icon">👁️</div>
                    <span className="stat-card-title">Open Rate</span>
                    <span className="stat-card-value">87.5%</span>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-card-icon">📱</div>
                    <span className="stat-card-title">Subscribed Students</span>
                    <span className="stat-card-value">18</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
        
        <footer style={{ 
          padding: '1.5rem', 
          backgroundColor: 'var(--background-primary)', 
          textAlign: 'center',
          borderTop: '1px solid var(--background-tertiary)',
          marginTop: 'auto'
        }}>
          <p>© {new Date().getFullYear()} NotifyEdu - Student Notification System</p>
        </footer>
      </div>
    );
  }
  
  export default App;