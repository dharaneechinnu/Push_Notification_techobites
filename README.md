# Crescent - Student Notification System

## Overview

NotifyEdu is a comprehensive web application designed to streamline communication between educational institutions and students through push notifications. This platform enables administrators to send targeted notifications to specific students or groups, while students can easily subscribe to receive important updates about classes, exams, and campus events directly on their devices.

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
git clone https://github.com/your-username/notifyedu.git](https://github.com/dharaneechinnu/Push_Notification_techobites
cd Push_Notification_techobites
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
# Create a .env file and add the following
API_URL=http://localhost:3500
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

4. Start the development server
```bash
npm start
```

## Service Worker

The application uses a service worker to enable push notifications. The service worker:
- Registers with the browser
- Handles push subscription management
- Processes incoming push messages
- Displays notifications to users
- Manages notification interactions

## Deployment

1. Build the production version
```bash
npm run build
```

2. Deploy to your hosting service
```bash
# Example for Netlify
netlify deploy --prod
```

## Security Considerations

- HTTPS is required for push notifications to work
- Student credentials are securely stored with password hashing
- VAPID keys are used to authenticate the push service
- Client-side validation prevents common input attacks

## Browser Compatibility

- Chrome (desktop and mobile)
- Firefox (desktop and mobile)
- Edge (desktop)
- Safari (push notification support limited)

## Future Enhancements

- Notification categorization system
- Scheduled notifications
- Read receipts
- Student groups and departments
- Rich media notifications
- Two-factor authentication

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contact

For support or inquiries, please contact support@notifyedu.com.
