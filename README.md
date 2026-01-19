# TaskFlow ✦

A beautiful task management app with secure cloud sync - no login required.

![TaskFlow App](https://img.shields.io/badge/Status-Live-success) ![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- 📅 **Interactive Calendar** - View tasks by day, week, or month
- 🔄 **Recurring Tasks** - Daily, weekly, and monthly options
- ☁️ **Cloud Sync** - Access your tasks from any device
- 🔐 **Secure Access Codes** - No email/password needed
- 🛡️ **Rate Limiting** - Protection against brute force attacks
- 📱 **Responsive Design** - Works on mobile and desktop

## How It Works

1. **Get Your Code** - Click "Get Started" to generate a unique 12-character access code
2. **Save It** - Store your code somewhere safe
3. **Access Anywhere** - Enter your code on any device to load your tasks

### Security Features

- 5 failed attempts → 24-hour IP block
- Auto-rotate code if attack detected
- Optional 4-digit PIN for extra security
- Optional recovery email

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Vercel (static)

## File Structure

```
TasksApp/
├── index.html        # Main app
├── index.css         # Styling
├── app.js            # Task manager logic
├── cloud-sync.js     # Supabase integration
├── config.js         # API configuration
└── supabase_schema.sql  # Database schema
```

## License

MIT © 2026
