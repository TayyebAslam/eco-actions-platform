# Eco Actions Admin Panel

Web-based administration dashboard for the Eco Actions sustainability engagement ecosystem. Built with Next.js 16, React 19, and TypeScript.

---

## Overview

The Eco Actions Admin Panel provides a comprehensive interface for managing schools, users, challenges, and content within the Eco Actions ecosystem. It supports multi-level user hierarchy with role-based access control.

### Key Features

- **Dashboard Analytics** - Real-time insights into participation, eco-actions, and environmental impact
- **School Management** - Create, edit, and manage schools with class/section hierarchy
- **User Management** - Manage admins, sub-admins, teachers, and students
- **Challenge System** - Create and monitor sustainability challenges
- **Content Management** - Manage activities, articles, badges, and levels
- **Category Management** - Organize content with customizable categories
- **School Request Approvals** - Review and approve new school registrations

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI Library | React 19 |
| Styling | Tailwind CSS |
| UI Components | Radix UI |
| State Management | TanStack React Query |
| Forms | React Hook Form + Zod |
| Tables | TanStack React Table |
| HTTP Client | Axios |
| Real-time | Socket.io Client |
| Icons | Lucide React |
| Notifications | Sonner |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/               # Authentication pages
│   │   ├── login/          # Admin login
│   │   ├── verify-email/   # Email verification
│   │   ├── school-setup/   # School registration flow
│   │   └── ...
│   ├── dashboard/          # Protected dashboard pages
│   │   ├── activities/     # Activity management
│   │   ├── admins/         # Admin user management
│   │   ├── articles/       # Article management
│   │   ├── badges/         # Badge management
│   │   ├── categories/     # Category management
│   │   ├── challenges/     # Challenge management
│   │   ├── levels/         # Level management
│   │   ├── profile/        # User profile
│   │   ├── school-requests/# School approval requests
│   │   ├── school-setup/   # School configuration
│   │   ├── schools/        # School management
│   │   └── ...
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/             # React components
│   ├── forms/              # Form components
│   ├── guards/             # Route protection components
│   ├── layout/             # Layout components (sidebar, header)
│   ├── modals/             # Modal dialogs
│   ├── sessions/           # Session management components
│   ├── tables/             # Data table components
│   ├── ui/                 # Base UI components (shadcn/ui)
│   └── views/              # Page view components
├── hooks/                  # Custom React hooks
│   ├── useDebounce.ts      # Debounce hook
│   ├── usePermissions.ts   # Permission checking hook
│   └── usePermissionUpdates.ts
├── lib/                    # Utility libraries
│   ├── api.ts              # API client functions
│   ├── apiRoutes.ts        # API route definitions
│   └── utils.ts            # Utility functions
├── providers/              # React context providers
│   ├── auth-provider.tsx   # Authentication context
│   ├── query-provider.tsx  # React Query provider
│   ├── socket-provider.tsx # Socket.io provider
│   └── theme-provider.tsx  # Theme context
├── proxy.ts                # API proxy configuration
└── types/                  # TypeScript type definitions
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn** or **pnpm**
- Running instance of [Eco Actions Backend](../Backend)

### Installation

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**

   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

---

## User Roles & Access

The admin panel supports the following user hierarchy:

| Role | Access Level |
|------|--------------|
| **Super Admin** | Full system access, manage all schools and users |
| **Admin** | School-level admin, manage school users and content |
| **Sub-Admin** | Limited admin access within assigned school |

Teachers and Students access the system through the mobile app.

---

## Authentication Flow

1. **Login** - Admin enters credentials at `/auth/login`
2. **JWT Token** - Server returns JWT stored in cookies/local storage
3. **Protected Routes** - `AuthGuard` component verifies authentication
4. **Role Check** - Permission hooks verify user role for specific actions
5. **Session Management** - Real-time session tracking via Socket.io

---

## Key Components

### Providers

- **AuthProvider** - Manages authentication state, login/logout, user data
- **QueryProvider** - TanStack React Query configuration with caching
- **SocketProvider** - Socket.io connection for real-time updates
- **ThemeProvider** - Light/dark theme management

### Guards

- **AuthGuard** - Protects routes, redirects unauthenticated users to login

### UI Components

Built on [shadcn/ui](https://ui.shadcn.com/) with Radix UI primitives:
- Button, Input, Select, Checkbox, Switch
- Dialog, Popover, Dropdown Menu
- Table, Tabs, Toast
- Avatar, Label, Separator

---

## API Integration

API functions are centralized in `src/lib/api.ts`:

```typescript
// Example usage
import { getSchools, createSchool } from '@/lib/api';

// Fetch schools
const schools = await getSchools();

// Create school
const newSchool = await createSchool(schoolData);
```

API routes are defined in `src/lib/apiRoutes.ts` for easy management.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | Yes |

---

## Development Guidelines

### Adding New Pages

1. Create folder in `src/app/dashboard/[feature-name]/`
2. Add `page.tsx` for the main page
3. Create sub-routes for create/edit: `create/page.tsx`, `[id]/page.tsx`

### Adding New Components

1. UI components go in `src/components/ui/`
2. Feature-specific components in appropriate subdirectory
3. Use TypeScript interfaces for props

### Form Handling

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

### Data Fetching

Use TanStack React Query for data fetching:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['schools'],
  queryFn: getSchools,
});
```

---

## Build & Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Configuration

For production, set `NEXT_PUBLIC_API_URL` to your production backend URL.

---

## License

ISC License

---

## Author

**Virtuenetz**
