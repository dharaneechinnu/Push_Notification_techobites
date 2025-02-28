import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3500';

function App() {
  const [view, setView] = useState('login'); // login, register, dashboard, admin
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [notification, setNotification] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Admin state
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [allStudents, setAllStudents] = useState([]);

  useEffect(() => {
    // Check if user is logged in
    if (token) {
      setView('dashboard');
      
      // Check if already subscribed to notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
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

  const fetchStudents = async () => {
    try {
      // Note: In a real app, you'd need an admin authentication route
      // This is just a placeholder for demonstration
      const response = await axios.get(`${API_URL}/students`);
      setAllStudents(response.data);
    } catch (error) {
      showNotification('Error fetching students', 'error');
    }
  };

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        return registration;
      } catch (error) {
        console.error('Service worker registration failed:', error);
        return null;
      }
    }
    return null;
  };

  const subscribeUserToPush = async () => {
    try {
      const registration = await registerServiceWorker();
      if (!registration) {
        showNotification('Service Worker registration failed', 'error');
        return;
      }

      // Get VAPID public key from server
      const response = await axios.get(`${API_URL}/vapidPublicKey`);
      const vapidPublicKey = response.data.publicKey;

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe the user
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Send subscription to server
      await axios.post(`${API_URL}/subscribe`, {
        studentId,
        subscription: subscription
      });

      setIsSubscribed(true);
      showNotification('Notification subscription successful!', 'success');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      showNotification('Failed to subscribe to notifications', 'error');
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
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      showNotification('Please select at least one student', 'error');
      return;
    }

    try {
      await axios.post(`${API_URL}/sendNotification`, {
        studentIds: selectedStudents,
        title: notificationTitle,
        message: notificationMessage
      });
      showNotification('Notifications sent successfully!', 'success');
      setNotificationTitle('');
      setNotificationMessage('');
      setSelectedStudents([]);
    } catch (error) {
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

  // Helper function to convert base64 to Uint8Array for VAPID key
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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Student Notification System</h1>
        {token && (
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        )}
      </header>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <main className="app-main">
        {view === 'login' && (
          <div className="auth-container">
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Student ID</label>
                <input 
                  type="text" 
                  value={studentId} 
                  onChange={(e) => setStudentId(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <button type="submit" className="btn-primary">Login</button>
            </form>
            <p>Don't have an account? <button onClick={() => setView('register')} className="link-btn">Register</button></p>
            <p><button onClick={() => setView('admin')} className="link-btn">Admin Panel</button></p>
          </div>
        )}

        {view === 'register' && (
          <div className="auth-container">
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Student ID</label>
                <input 
                  type="text" 
                  value={studentId} 
                  onChange={(e) => setStudentId(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <button type="submit" className="btn-primary">Register</button>
            </form>
            <p>Already have an account? <button onClick={() => setView('login')} className="link-btn">Login</button></p>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="dashboard-container">
            <h2>Welcome, Student {studentId}</h2>
            <div className="notification-card">
              <h3>Push Notifications</h3>
              {!isSubscribed ? (
                <>
                  <p>Subscribe to receive important notifications from your institution.</p>
                  <button onClick={subscribeUserToPush} className="btn-primary">
                    Enable Notifications
                  </button>
                </>
              ) : (
                <p className="subscribed-msg">
                  You're subscribed to notifications! ✅
                </p>
              )}
            </div>

            <div className="dashboard-info">
              <h3>Important Information</h3>
              <p>Stay updated with the latest announcements and notifications from your institution.</p>
              <p>Make sure to enable notifications to receive timely updates about classes, exams, and events.</p>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="admin-container">
            <h2>Admin Panel</h2>
            <form onSubmit={handleSendNotification} className="notification-form">
              <h3>Send Notifications</h3>
              <div className="form-group">
                <label>Notification Title</label>
                <input 
                  type="text" 
                  value={notificationTitle} 
                  onChange={(e) => setNotificationTitle(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Notification Message</label>
                <textarea 
                  value={notificationMessage} 
                  onChange={(e) => setNotificationMessage(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="student-selection">
                <h4>Select Students</h4>
                {allStudents.length > 0 ? (
                  <div className="student-list">
                    {allStudents.map(student => (
                      <div key={student._id} className="student-item">
                        <input 
                          type="checkbox" 
                          id={student._id}
                          checked={selectedStudents.includes(student.studentId)}
                          onChange={() => toggleStudentSelection(student.studentId)}
                        />
                        <label htmlFor={student._id}>{student.studentId}</label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No students found or you need to implement the /students endpoint.</p>
                )}
                <div className="selection-controls">
                  <button 
                    type="button" 
                    onClick={() => setSelectedStudents(allStudents.map(s => s.studentId))}
                    className="btn-secondary"
                  >
                    Select All
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSelectedStudents([])}
                    className="btn-secondary"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary">Send Notification</button>
            </form>
            
            <div className="admin-actions">
              <button onClick={() => setView('login')} className="btn-secondary">Back to Login</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;