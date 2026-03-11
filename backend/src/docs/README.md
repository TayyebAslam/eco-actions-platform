# 🎯 Swagger API Order Management

## Kaise Use Karein (Super Simple)

### File Location:
```
src/docs/apiOrder.ts
```

### Instructions:

#### 1. File Open Karein
```typescript
// src/docs/apiOrder.ts

export const apiOrder = [
  "/auth/login-user",
  "/auth/login-admin",
  "/auth/logout",
  "/auth/request-email-change",    ← Yahan se
  "/auth/confirm-email-change",
  "/auth/change-password",
  // ...
];
```

#### 2. Endpoints Ko Upar/Neeche Move Karein

**Example - Email change APIs ko upar lana:**

**BEFORE:**
```typescript
export const apiOrder = [
  "/auth/login-user",
  "/auth/login-admin",
  "/auth/logout",
  "/auth/change-password",
  "/auth/request-email-change",    ← Neeche hai
  "/auth/confirm-email-change",    ← Neeche hai
  "/auth/delete-account",
];
```

**AFTER (Cut-paste kar ke move karein):**
```typescript
export const apiOrder = [
  "/auth/login-user",
  "/auth/login-admin",
  "/auth/request-email-change",    ← Upar move kar diya
  "/auth/confirm-email-change",    ← Upar move kar diya
  "/auth/logout",
  "/auth/change-password",
  "/auth/delete-account",
];
```

#### 3. Save + Server Restart
```bash
# File save karo (Ctrl+S)
# Server restart karo:
npm run dev
```

**Console mein dikhega:**
```
✅ Swagger API order applied from src/docs/apiOrder.ts
```

#### 4. Swagger Check Karein
```
http://localhost:5000/api-docs
```

---

## ✅ Done! Super Simple!

**Jo array mein upar hai, wo Swagger mein pehle dikhega!**

---

## 📁 Files Structure:

```
src/docs/
├── apiOrder.ts          ← YAHAN ORDER CHANGE KARO
├── README.md            ← Yeh file (instructions)
├── routes/
│   ├── auth.yaml        ← Auth API documentation
│   └── profile.yaml     ← Profile API documentation
└── schemas/
    └── common.yaml      ← Common schemas
```

---

## 💡 Tips:

### 1. Logical Grouping
Related APIs ko saath rakho:
```typescript
[
  "/auth/login-user",
  "/auth/login-admin",
  "/auth/logout",              // Login/logout together

  "/auth/request-email-change",
  "/auth/confirm-email-change", // Email management together

  "/auth/forget-password",
  "/auth/reset-password",
  "/auth/change-password",      // Password management together
]
```

### 2. Common First
Jo APIs zyada use hoti hain upar:
```typescript
[
  "/auth/login-user",          // Most used
  "/auth/logout",
  "/auth/profile",
  // ... less common
]
```

### 3. Workflow Order
User journey ke hisaab se:
```typescript
[
  "/auth/login-user",          // 1. Login
  "/auth/profile",             // 2. View profile
  "/auth/change-password",     // 3. Change password
  "/auth/logout",              // 4. Logout
]
```

---

## 🔍 Quick Test:

1. Open: `src/docs/apiOrder.ts`
2. Move `/auth/request-email-change` to position 3 (after login/logout)
3. Save file
4. Restart server: `npm run dev`
5. Check: `http://localhost:5000/api-docs`

**Done! Email change API ab upar dikhegi! ✨**
