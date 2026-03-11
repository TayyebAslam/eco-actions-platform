# Thrive – Sustainability Engagement Ecosystem 🌿

Thrive is a comprehensive digital ecosystem designed to gamify sustainability education. It connects schools, teachers, and students to track real-world eco-friendly actions, turning environmental responsibility into an engaging, rewarding experience.

![Thrive Logo](public/assets/logo.png)

---

## 🚀 Key Features

### 🏫 For Schools (Web Admin Panel)
*   **Multi-Level Hierarchy:** Seamlessly manage School Admins, Sub-Admins, Teachers, and Students
*   **Analytics Dashboard:** Real-time insights into participation rates, eco-actions, and environmental impact
*   **Custom Challenges:** Create school-wide sustainability missions and competitions
*   **User Management:** Comprehensive role-based access control and user administration

### 👩‍🏫 For Teachers (Mobile App - Admin View)
*   **Swipe-to-Verify:** Quick approval/rejection of student submissions with an intuitive interface
*   **Class Management:** View detailed student progress and activity logs
*   **Direct Engagement:** Communicate with students and provide feedback on submissions
*   **Performance Tracking:** Monitor class-wide sustainability metrics

### 🎓 For Students (Mobile App - User View)
*   **Gamified Profiles:** Earn XP, level up (Green Rookie → Eco-Champion), and collect badges
*   **Activity Logging:** Upload photos of eco-actions (recycling, planting, conservation, etc.)
*   **Leaderboards:** Compete with peers within your school and globally
*   **Learning Hub:** Access educational content, articles, and quizzes for bonus rewards
*   **Social Features:** Share achievements and inspire others

---

## 🛠 Tech Stack

### Backend
*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js with TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Knex.js for query building and migrations
*   **Authentication:** JWT (JSON Web Tokens)
*   **Validation:** Zod for schema validation
*   **Email Service:** Nodemailer
*   **File Uploads:** Multer
*   **Security:** Bcrypt for password hashing, Rate limiting
*   **Logging:** Morgan
*   **API Testing:** Axios

### DevOps & Infrastructure
*   **Containerization:** Docker & Docker Compose
*   **Development:** Nodemon with hot-reload
*   **Build System:** TypeScript Compiler (tsc)

---

## 📂 Project Structure

```bash
/src
├── config/           # Database & App Configuration (CORS, Morgan, DB Connection)
├── controller/       # Request Handlers
│   ├── admin/        # Admin-specific controllers (Users, Cuisines)
│   ├── auth.controller/    # Authentication logic
│   └── profile.controller/ # User profile management
├── db/
│   ├── migrations/   # Database schema migrations (Knex)
│   └── seeds/        # Database seed files (e.g., super admin)
├── middlewares/      # Custom middlewares
│   ├── authMiddleware.ts       # JWT authentication
│   ├── authAdminMiddleware.ts  # Admin-only access
│   ├── requestlimit.ts         # Rate limiting
│   └── trycatch.ts             # Error handling wrapper
├── routes/           # API route definitions
│   ├── admin/        # Admin routes
│   ├── auth.routes/  # Authentication routes
│   └── common.routes/ # Public routes
├── services/         # Business Logic Layer
│   ├── jwt/          # JWT token generation & verification
│   ├── multer/       # File upload handling
│   └── nodemailer/   # Email services (OTP, Password Reset, Verification)
├── utils/            # Helper functions & constants
│   ├── constants/    # Application constants
│   ├── enums/        # TypeScript enums (User roles, Auth states)
│   ├── helperFunctions/ # Utility functions (OTP generator, Response helpers)
│   └── types/        # TypeScript type definitions
└── validations/      # Zod input validation schemas
```

---

## ⚡ Getting Started

### Prerequisites
*   **Node.js** (v18 or higher)
*   **Docker** & **Docker Compose**
*   **PostgreSQL** (or use the provided Docker setup)
*   **npm** or **yarn** package manager

### Installation Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/shahzad-jamil/thrive-backend.git
    cd thrive-backend
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    
    Create a `.env` file in the root directory and configure the following variables:
    ```env
    # Database
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=postgres
    DB_PASSWORD=your_password
    DB_NAME=thrive_db
    
    # JWT
    JWT_SECRET=your_jwt_secret_key
    JWT_EXPIRES_IN=7d
    
    # Email (Nodemailer)
    EMAIL_HOST=smtp.gmail.com
    EMAIL_PORT=587
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASSWORD=your_app_password
    
    # Server
    PORT=3000
    NODE_ENV=development
    ```

4.  **Start Database (Docker)**
    ```bash
    docker-compose up -d postgres
    ```

5.  **Run Database Migrations**
    ```bash
    npm run knex migrate:latest
    ```

6.  **Seed Initial Data (Optional)**
    ```bash
    npm run knex seed:run
    ```

7.  **Start Development Server**
    ```bash
    npm run dev
    ```
    
    The server will start on `http://localhost:3000` (or your configured PORT)

### Available Scripts

*   `npm run dev` - Start development server with auto-reload and Docker PostgreSQL
*   `npm start` - Start production server (runs migrations automatically)
*   `npm run build` - Compile TypeScript to JavaScript
*   `npm run knex` - Run Knex CLI commands
*   `npm run migration` - Execute migration script

---

## � Database Schema

The database follows a robust, scalable architecture designed for multi-tenant support and gamification:

### Core Tables

**Users Table**
*   Stores user information for all roles (Super Admin, Admin, Teacher, Student)
*   Role-based access control via `role` field
*   Social authentication support via `social_id`
*   Email verification and account status tracking
*   Profile customization (name, image, zip code)

**Password Resets Table**
*   Secure password recovery mechanism
*   Token-based reset flow
*   Email-indexed for quick lookups

**Cuisines & User Cuisines Tables**
*   Manages user food preferences
*   Many-to-many relationship between users and cuisines
*   Supports personalization features

All migrations can be found in [`src/db/migrations/`](src/db/migrations/)

---

## 🔒 Authentication Flow

1. **Registration** → Email verification via OTP
2. **Login** → JWT token issued
3. **Protected Routes** → Token validation via middleware
4. **Role-Based Access** → Admin/User specific endpoints
5. **Password Recovery** → Email-based reset with secure tokens

---

## 🧪 API Endpoints Overview

### Authentication
*   `POST /api/auth/register` - User registration
*   `POST /api/auth/login` - User login
*   `POST /api/auth/verify-email` - Email verification
*   `POST /api/auth/forgot-password` - Password reset request
*   `POST /api/auth/reset-password` - Reset password with token

### Admin
*   `GET /api/admin/users` - List all users
*   `POST /api/admin/cuisines` - Create cuisine
*   `PUT /api/admin/users/:id` - Update user

### Profile
*   `GET /api/profile` - Get user profile
*   `PUT /api/profile` - Update profile
*   `POST /api/profile/avatar` - Upload profile picture

---

## 🤝 Contributing

We welcome contributions to make Thrive even better! Here's how you can help:

1.  **Fork the Repository**
    ```bash
    git clone https://github.com/YOUR_USERNAME/thrive-backend.git
    ```

2.  **Create a Feature Branch**
    ```bash
    git checkout -b feature/amazing-sustainability-feature
    ```

3.  **Make Your Changes**
    *   Follow TypeScript best practices
    *   Add proper type definitions
    *   Include validation for new endpoints
    *   Update migrations if schema changes are needed

4.  **Test Your Changes**
    ```bash
    npm run build
    npm start
    ```

5.  **Commit Your Changes**
    ```bash
    git commit -m 'feat: add amazing sustainability feature'
    ```
    Follow conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, etc.

6.  **Push to Your Fork**
    ```bash
    git push origin feature/amazing-sustainability-feature
    ```

7.  **Open a Pull Request**
    *   Provide a clear description of changes
    *   Reference any related issues
    *   Include screenshots/examples if applicable

### Development Guidelines
*   Maintain code consistency with existing patterns
*   Add JSDoc comments for complex functions
*   Use Zod schemas for all input validation
*   Handle errors gracefully with appropriate status codes
*   Follow the existing folder structure

---

## 📝 License

This project is licensed under the **ISC License**.

---

## 👨‍💻 Author

**Virtuenetz**  
*Empowering sustainability through technology*

---

## 🌟 Acknowledgments

*   Built with passion for environmental education
*   Designed to inspire the next generation of eco-warriors
*   Making sustainability engaging and rewarding

---

<div align="center">

**Thrive** — Empowering the next generation of eco-warriors 🌍

*Together, we can make a difference, one eco-action at a time.*

</div>
