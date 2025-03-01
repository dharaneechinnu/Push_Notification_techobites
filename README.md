# Crescent - Student Notification System
## Features

### For Students
- **Secure Account System**: Personal login with student ID and password
- **Push Notifications**: Receive important updates directly on supported devices
- **Multiple Notification Categories**: 
  - Class Updates (schedule changes, assignments, instructor announcements)
  - Exam Alerts (upcoming tests, deadlines, results)
  - Campus Events (workshops, seminars, cultural events)
- **Simple Opt-in Process**: One-click subscription to push notifications
- **Test Notifications**: Verify notification functionality with a test feature

### For Administrators
- **Admin Dashboard**: Central hub for managing student communications
- **Targeted Messaging**: Select specific students or groups to receive notifications
- **Message Customization**: Create personalized notification titles and messages
- **Analytics Dashboard**: Track student engagement metrics
  - Total registered students
  - Notifications sent
  - Open rates
  - Subscription statistics

## Technical Implementation

### Frontend
- React.js for the user interface
- Custom CSS with responsive design for all device types
- Service Worker for push notification handling

### Backend
- Node.js API serving the application
- Database integration for student accounts and notification history
- Web Push API implementation with subscription management

## Installation

1. Clone the repository
```bash
git clone https://github.com/dharaneechinnu/Push_Notification_techobites.git
cd Push_Notification_techobites
```


3. Set up environment variables in backend folder
```bash
# Create a .env file and add the following
API_URL=http://localhost:3500
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

4. Start the development server in backend
```bash
cd backend
npm install
npm run dev
```
5. go to frontend Folder
   ```bash
   cd frontend/noti
   npm install
   ```
6. Start frontend server
   ```bash
   npm start
   ```
## License

MIT License - See [LICENSE](LICENSE) for details.
