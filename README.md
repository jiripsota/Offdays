# Offdays - Enterprise Password Manager

Offdays is a self-hosted, simplified enterprise password manager designed for teams. It allows secure sharing of credentials, group management, and audit logging.

## 🚀 Features

- **Unified Dashboard**: A clean, "premium" view of all passwords, credit cards, and secure notes with glassmorphism effects.
- **Group Management**: Advanced organization of users into groups with role-based access (Leaders vs. Members).
- **Hybrid Storage Architecture**: Metadata is stored in PostgreSQL, while sensitive payloads are securely encrypted and stored in **Google Cloud Datastore**, **Firestore**, or **Google Drive**.
- **Secure Item Sharing**: granular sharing of individual items or entire groups with team members.
- **Import/Export Wizards**: Polished, multi-step wizards for moving data between groups or importing from external sources (CSV).
- **Native Support for 7 Languages**: Fully localized in **English**, **Czech**, **German**, **Spanish**, **French**, **Italian**, and **Polish**.
- **Google Workspace Integration**: Seamlessly sync users and directory information with built-in duplicate detection.
- **Security & Compliance**: Comprehensive audit logs, session management, and industry-standard encryption (Fernet).
- **Modern UI/UX**: System-aware Dark/Light modes, splash screens, and skeleton loading for a zero-flicker experience.
- **Premium Components**: Custom-built "Glass" cards, animated badges, and theme-aware avatars for a high-end feel.
- **Mobile-Optimized Interface**: Read-only mobile view with optimized table layout, hidden admin features, and wider name columns for better readability on small screens.

## 🛠️ Technology Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: PostgreSQL (Cloud SQL) for metadata.
- **Storage**:
    - **Google Cloud Datastore** (or Firestore in Datastore Mode) for encrypted payloads.
    - **Google Drive** (Optional) for encrypted payloads.
    - **Google Cloud Storage** for public assets (avatars).
- **Encryption**: Fernet (Symmetric AES) - Encryption at Rest
- **Auth**: Google OAuth2 + JWT
- **ORM**: SQLAlchemy 2.0
- **Migrations**: Alembic

### Frontend
- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **UI Library**: [Radix UI](https://www.radix-ui.com/) + [Shadcn/ui](https://ui.shadcn.com/)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Icons**: Lucide React
- **Internationalization**: i18next

## ⚙️ Configuration

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database
DATABASE_URL=sqlite:///./dev.db

# Security
SECRET_KEY=your-super-secret-key-for-jwt
ENCRYPTION_KEY=your-fernet-key-base64  # Generate using cryptography.fernet.Fernet.generate_key()

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback

# Storage & IAM
GOOGLE_CREDENTIALS=path/to/service-account.json
GOOGLE_SERVICE_ACCOUNT=your-service-account@project.iam.gserviceaccount.com
```

## 📦 Installation & Setup

You can run the application either using Docker (recommended) or locally for development.

### Option 1: Docker (Easy Start)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jiripsota/Offdays.git
   cd Offdays
   ```

2. **Start the application:**
   ```bash
   docker compose up --build
   ```

3. **Access the application:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000`

### Option 2: Local Development

Prerequisites: Node.js (v18+) and Python (v3.10+).

#### Backend Setup
1. Navigate to `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations (create schema):
   ```bash
   alembic upgrade head
   ```
5. Start the backend:
   ```bash
   uvicorn app.main:app --reload
   ```

#### Frontend Setup
1. Navigate to `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

## 🧪 Testing

### Backend Tests
Run the pytest suite to verify API endpoints, database interactions, and security rules.
```bash
cd backend
pytest
```

### Frontend Tests
Run unit and integration tests using Vitest.
```bash
cd frontend
npm run test
```

## 🚀 Production Deployment

Deploy to Google Cloud Run with PostgreSQL:

```bash
cd backend
./deploy.sh
```

The script automatically loads secrets from Google Secret Manager and deploys to Cloud Run.

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 📚 Project Rules & Contributing

Please refer to [project_rules.md](./project_rules.md) for detailed coding standards, naming conventions, and contribution guidelines.

## 🔒 Security

- **Encryption at Rest**: Sensitive fields (passwords, notes, details) are encrypted using Fernet (AES) before being sent to storage.
- **Secure File Naming**: Vault files use `{tenant_id}_{uuid}` format without extensions to prevent information leakage.
- **Auditability**: Every access and modification is logged.
- **Rate Limiting**: Auth endpoints are protected against brute-force attacks.
- **Security Headers**: HSTS, X-Frame-Options, and Content-Type-Options are enforced.
- **Secure Configuration**: Application refuses to start in production with insecure defaults.
- **No Secrets in Repo**: Ensure `.env` and `service-account.json` are git-ignored.
