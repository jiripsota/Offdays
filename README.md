# Offdays - Smart Vacation Management

Offdays is a modern, self-hosted leave management system designed for teams and organizations. It simplifies vacation requests, tracks entitlements, and synchronizes absences with Google Calendar to keep everyone in sync.

## 🚀 Features

- **Intuitive Dashboard**: A beautiful, vacation-themed interface for users to track their remaining days and pending requests.
- **Approval Workflow**: Streamlined multi-level approval process (Manager/Admin) with automated email notifications.
- **Smart Calendar Integration**:
    - **Personal Sync**: Automatic synchronization of approved leaves to the user's personal Google Calendar.
    - **Shared Team Calendar**: Built-in support for a company-wide "Absence Calendar" via service account integration.
- **Automatic Multi-Tenancy**: Zero-config organizational onboarding based on Google Workspace domains with strict data isolation.
- **Entitlement Tracking**: Real-time calculation of accrued vs. remaining days, including pro-rated logic for partial years.
- **Premium UI/UX**: High-end aesthetics featuring a thematic splash screen, animated login visuals, and a responsive mobile layout.
- **Global Localization**: Native support for **English**, **Czech**, **German**, **Spanish**, **French**, **Italian**, and **Polish**.

## 🛠️ Technology Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: PostgreSQL (Cloud SQL) for all metadata and tenant info.
- **Authentication**: Strict Google OAuth2 with Hosted Domain (HD) enforcement.
- **Integrations**: Google Calendar API (Service Account & User Delegated).
- **ORM**: SQLAlchemy 2.0 with strict multi-tenant scoping.

### Frontend
- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **UI Architecture**: Radix UI + [Shadcn/ui](https://ui.shadcn.com/) with a custom "Vacation" design system.
- **Interactions**: Framer Motion for smooth transitions and parallax background effects.
- **State Management**: TanStack Query (React Query) for efficient caching.

## ⚙️ Configuration

Create a `.env` file in the `backend` directory:

```env
# Core
DATABASE_URL=postgresql://user:pass@localhost:5432/offdays
SECRET_KEY=your-secure-jwt-secret

# Google OAuth (Workspace Required)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback

# Google Service Account (For Shared Calendar)
GOOGLE_SERVICE_ACCOUNT_FILE=service-account-key.json

# Assets & Storage
GCS_BUCKET_NAME=your-avatars-bucket
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=app-password
```

## 📦 Installation & Setup

### Option 1: Docker (Recommended)

1. **Clone & CD**:
   ```bash
   git clone https://github.com/jiripsota/Offdays.git
   cd Offdays
   ```
2. **Spin up stack**:
   ```bash
   docker compose up --build
   ```

### Option 2: Local Development

Prerequisites: Node.js 18+ and Python 3.10+.

#### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Run migrations
alembic upgrade head
# Start server
uvicorn app.main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔒 Security & Privacy

- **Domain Isolation**: Strict multi-tenancy baseline—users can only see and interact with data matching their Google Workspace domain.
- **OWASP Hardening**: Protected against IDOR, Broken Access Control, and SSRF (verified by latest audit).
- **No Passwords**: Authenticated 100% via Google Identity; no local password storage.
- **Secure Cookies**: HTTP-only, Secure (in production), and SameSite:Lax.
- **Audit Logging**: Comprehensive internal tracking of all administrative actions.

## 🚀 Deployment

Deployment to **Google Cloud Run** is supported via the included `deploy.sh` script.

```bash
./deploy.sh
```

For more details on production setup and Google Cloud configuration, refer to [DEPLOYMENT.md](./DEPLOYMENT.md).
