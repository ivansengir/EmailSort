# 📧 EmailSort AI

**AI-Powered Email Management & Automated Unsubscription Platform**

A full-stack web application that intelligently categorizes emails and automates the unsubscription process using AI agents, including complex form interactions via Puppeteer.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)](https://openai.com/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [How It Works](#-how-it-works)
- [Setup & Installation](#-setup--installation)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**EmailSort AI** solves the common problem of inbox overload by:

1. **Automatically syncing** emails from Gmail accounts
2. **Categorizing them intelligently** using OpenAI's GPT models
3. **Enabling bulk actions** (delete, move, unsubscribe)
4. **Automating unsubscription** with an AI agent that:
   - Extracts unsubscribe links from emails (any language)
   - Navigates to unsubscribe pages
   - Fills out forms automatically
   - Handles complex interactions (radio buttons, multi-step forms, CAPTCHAs)
   - Uses Puppeteer for JavaScript-heavy pages

**Target Users**: Individuals overwhelmed with promotional emails, newsletters, and subscriptions.

**Problem Solved**: Manual unsubscription is tedious (finding links, filling forms, clicking confirmations). This automates 90%+ of that process.

---

## ✨ Key Features

### 🤖 AI-Powered Unsubscription
- **Smart Link Extraction**: OpenAI analyzes email content (HTML + text) to find unsubscribe links in any language
- **Automated Form Filling**: AI extracts form fields and submits them automatically
- **Complex Interactions**: MCP server with Puppeteer handles JavaScript-heavy sites
- **Multi-Method Support**:
  - Direct HTTP links (instant unsubscribe)
  - Auto-filled forms (AI extracts and submits data)
  - Puppeteer automation (for complex pages like MediaMarkt)
- **Detailed Logs**: Track success/failure of each unsubscribe attempt with method, target, and status

### 📊 Email Management
- **Multi-Account Support**: Connect multiple Gmail accounts via Google OAuth
- **AI Categorization**: GPT-4o-mini classifies emails into custom categories
- **Batch Processing**: Process 10 emails in parallel for fast sync
- **Custom Categories**: Create, edit, and delete categories with colors and descriptions
- **Move Emails**: Drag emails between categories with automatic count updates
- **Bulk Actions**: Select multiple emails and delete or unsubscribe in one click

### 🔐 Security & Privacy
- **Google OAuth 2.0**: Secure authentication without storing passwords
- **Row-Level Security (RLS)**: Supabase ensures users only see their own data
- **Encrypted Storage**: Gmail tokens encrypted at rest
- **Service Role Pattern**: Edge Functions use dual-client pattern for security
- **No Data Sharing**: All data stays within your infrastructure

### 🎨 User Experience
- **Real-time Updates**: Live sync progress with detailed status messages
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Loading States**: Clear feedback for long-running operations (sync, unsubscribe)
- **Toast Notifications**: Success/error messages for all actions
- **Modal Details**: View full email content with HTML/text toggle

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Auth Page   │  │  Dashboard   │  │ Category Page│          │
│  │  (OAuth)     │  │  (Overview)  │  │ (Email List) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            ▼                                       │
│                   Supabase Client (JS SDK)                        │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database (Row-Level Security)                │   │
│  │  ├─ users (auth mapping)                                 │   │
│  │  ├─ gmail_accounts (OAuth tokens)                        │   │
│  │  ├─ categories (user-defined)                            │   │
│  │  ├─ emails (synced from Gmail)                           │   │
│  │  └─ unsubscribe_logs (attempt tracking)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno runtime)                           │   │
│  │  ├─ import-emails     (Gmail sync + AI categorization)   │   │
│  │  ├─ move-emails       (Category transfers)               │   │
│  │  ├─ bulk-actions      (Delete/unsubscribe batch)         │   │
│  │  └─ unsubscribe-email (AI unsubscribe automation)        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  OpenAI API  │  │  Gmail API   │  │  MCP Server  │          │
│  │  GPT-4o-mini │  │  (OAuth 2.0) │  │  (Puppeteer) │          │
│  │  GPT-5-mini  │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Example: Unsubscribe Action

1. **User clicks "Unsubscribe"** on selected emails in CategoryPage
2. **Frontend calls** `executeBulkAction('unsubscribe', { emailIds })`
3. **Supabase Edge Function** `bulk-actions` receives request
4. **For each email**:
   - Fetch email HTML/text from database
   - Call `attemptUnsubscribe()` in `_shared/unsubscribe.ts`
   - **AI extracts link** via OpenAI `extractUnsubscribeLinkWithAI()`
   - **Fetch unsubscribe page** with HTTP client
   - **AI analyzes page** via OpenAI `analyzeUnsubscribePageWithAI()`
   - **If form detected**: Try MCP server (Puppeteer) or auto-submit
   - **If direct link**: Mark as success
   - **Log result** to `unsubscribe_logs` table
5. **Frontend receives results** and shows toast notification
6. **Redirect to logs page** to view detailed results

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with RLS
  - Edge Functions (Deno runtime)
  - Authentication (Google OAuth)
  - Real-time subscriptions
- **Deno 2.1.4** - Runtime for Edge Functions

### AI & Automation
- **OpenAI API**
  - `gpt-4o-mini` - Email categorization (fast, cheap)
  - `gpt-5-mini` - Link extraction & page analysis
- **Puppeteer** - Headless browser automation (MCP server)
- **Gmail API** - Email fetching with OAuth 2.0

### Infrastructure
- **Render** - Hosting for frontend & MCP server
- **Supabase Cloud** - Managed backend

---

## 📁 Project Structure

```
EmailSort/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── EmailDetailModal.tsx  # Email content viewer
│   │   └── EditCategoryModal.tsx # Category editor
│   ├── pages/                    # Page components
│   │   ├── AuthPage.tsx          # Login with Google
│   │   ├── DashboardPage.tsx     # Main overview
│   │   ├── CategoryPage.tsx      # Email list by category
│   │   ├── UnsubscribeLogsPage.tsx # Unsubscribe history
│   │   └── DebugPage.tsx         # Development tools
│   ├── context/                  # React context
│   │   └── AuthContext.tsx       # Authentication state
│   ├── lib/                      # Utilities
│   │   ├── supabase.ts           # Supabase client
│   │   ├── auth.ts               # Auth helpers
│   │   └── data.ts               # API functions
│   ├── types/                    # TypeScript types
│   │   └── index.ts              # Shared types
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
│
├── supabase/                     # Supabase configuration
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── import-emails/        # Gmail sync + AI categorization
│   │   │   └── index.ts
│   │   ├── move-emails/          # Category transfers
│   │   │   └── index.ts
│   │   ├── bulk-actions/         # Batch delete/unsubscribe
│   │   │   └── index.ts
│   │   ├── unsubscribe-email/    # Single email unsubscribe
│   │   │   └── index.ts
│   │   └── _shared/              # Shared utilities
│   │       ├── util.ts           # CORS, responses
│   │       ├── openai.ts         # AI functions
│   │       └── unsubscribe.ts    # Unsubscribe logic
│   └── migrations/               # Database migrations
│       ├── 20241102000001_initial_schema.sql
│       ├── 20241102000002_add_email_selection.sql
│       ├── 20251103000003_add_category_count_functions.sql
│       ├── 20251103000004_fix_user_id.sql
│       └── 20251103000005_restore_user.sql
│
├── mcp-server/                   # MCP Server (Puppeteer)
│   ├── src/
│   │   └── server.ts             # Express + Puppeteer
│   ├── package.json
│   └── tsconfig.json
│
├── public/                       # Static assets
│   └── _redirects               # Render SPA routing
│
├── package.json                  # Frontend dependencies
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
├── .env                         # Environment variables
└── README.md                    # This file
```

---

## 🔧 How It Works

### 1️⃣ Email Synchronization

**Process**:
1. User clicks "Sync All" button
2. Frontend calls `invokeEmailSync()` → triggers `import-emails` Edge Function
3. Edge Function:
   - Fetches Gmail API credentials from database
   - Queries Gmail API for unread emails (batch of 500)
   - For each email:
     - Extract metadata (subject, from, date, labels)
     - Extract content (HTML + plain text)
     - Send to OpenAI `gpt-4o-mini` for categorization
     - Match to existing categories or create "Uncategorized"
     - Save to `emails` table
     - Increment category email count
4. Process 10 emails in parallel for speed
5. Returns progress updates to frontend

**AI Categorization Prompt**:
```typescript
You are an email categorization assistant.
Categories: ${categories.map(c => c.name).join(', ')}
Analyze this email and assign ONE category.
Response format: { "category": "CategoryName", "reasoning": "..." }
```

### 2️⃣ AI-Powered Unsubscription

**Process**:
1. User selects emails and clicks "Unsubscribe (X)"
2. Frontend shows loading overlay with cold start warning
3. Edge Function `bulk-actions` processes each email:

#### Step A: Extract Unsubscribe Link (AI)
```typescript
// OpenAI analyzes email content
const { link, method } = await extractUnsubscribeLinkWithAI(html, text);
// Finds links like:
// - https://example.com/unsubscribe?token=xyz
// - mailto:unsubscribe@example.com (skipped)
```

#### Step B: Fetch Unsubscribe Page
```typescript
const response = await fetch(link, {
  method: "GET",
  redirect: "follow",
  headers: { 'User-Agent': 'Mozilla/5.0...' }
});
const pageHtml = await response.text();
```

#### Step C: Analyze Page (AI)
```typescript
// OpenAI determines page type
const analysis = await analyzeUnsubscribePageWithAI(url, pageHtml);
// Returns: { actionType: "success" | "form" | "captcha" | "login" | "unknown" }
```

#### Step D: Handle Based on Type

**Direct Link (success)**:
```typescript
// Already unsubscribed by clicking link
return { status: "success", method: "http", target: url };
```

**Form Detected**:
```typescript
// Try MCP server (Puppeteer) for complex interactions
const mcpResponse = await fetch(`${MCP_SERVER_URL}/unsubscribe`, {
  method: 'POST',
  body: JSON.stringify({ url }),
  signal: AbortSignal.timeout(90000) // 90s for cold start
});

// If MCP unavailable, try basic form submission
const formData = await extractFormDataWithAI(pageHtml);
await submitForm(url, formData);
```

**CAPTCHA/Login**:
```typescript
// Cannot automate - log as error
return { status: "error", method: "manual", error: "CAPTCHA required" };
```

4. Log result to `unsubscribe_logs` table
5. Frontend redirects to logs page automatically

### 3️⃣ MCP Server (Puppeteer Automation)

**Purpose**: Handle complex unsubscribe pages that require JavaScript interactions (radio buttons, multi-step forms, etc.)

**Process**:
```typescript
// Express server with Puppeteer
app.post('/unsubscribe', async (req, res) => {
  const { url } = req.body;
  
  // Launch headless Chrome
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to unsubscribe page
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  // Use OpenAI to analyze page and generate instructions
  const screenshot = await page.screenshot({ encoding: 'base64' });
  const instructions = await getAIInstructions(screenshot);
  
  // Execute instructions (click buttons, fill forms, etc.)
  for (const instruction of instructions) {
    if (instruction.type === 'click') {
      await page.click(instruction.selector);
    }
    if (instruction.type === 'type') {
      await page.type(instruction.selector, instruction.value);
    }
  }
  
  await browser.close();
  res.json({ success: true });
});
```

**Deployed on**: Render (Web Service with Docker)
**Cold Start**: First request may take 30-60s (container spin-up + Puppeteer launch)

### 4️⃣ Authentication Architecture

**Critical Detail**: Supabase Auth vs Application Users

```typescript
// TWO user tables:
// 1. auth.users (Supabase Auth) - JWT contains this ID
// 2. public.users (Application) - Has own ID + auth_id reference

// JWT token contains: auth.users.id = "92f51029-47a8-450e-bc01..."
// Database operations use: public.users.id = "93df02d7-5e21-431f-99bf..."

// Edge Functions MUST map between them:
const { data: { user } } = await authClient.auth.getUser(); // Token user
const { data: dbUser } = await adminClient
  .from("users")
  .select("id")
  .eq("auth_id", user.id) // Map auth_id → database id
  .maybeSingle();
const actualUserId = dbUser.id; // Use for all DB operations
```

**Why?**: RLS policies check `public.users.id`, but JWT contains `auth.users.id`. Must map via `auth_id` field.

### 5️⃣ Row-Level Security (RLS)

**Policy Example**:
```sql
-- Users can only see their own emails
CREATE POLICY "Users can view own emails"
ON emails FOR SELECT
USING (auth.uid() = user_id);

-- Categories belong to user
CREATE POLICY "Users can manage own categories"
ON categories FOR ALL
USING (auth.uid() = user_id);
```

**Edge Functions**: Use `SERVICE_ROLE_KEY` to bypass RLS, but manually validate ownership:
```typescript
const adminClient = createClient(url, SERVICE_ROLE_KEY);

// Validate user owns category
const { data: category } = await adminClient
  .from("categories")
  .select("user_id")
  .eq("id", categoryId)
  .single();

if (category.user_id !== actualUserId) {
  return new Response("Forbidden", { status: 403 });
}
```

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js 18+**
- **npm or pnpm**
- **Supabase CLI** (`npm install -g supabase`)
- **Google Cloud Project** (for Gmail OAuth)
- **OpenAI API Key**

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/EmailSort.git
cd EmailSort
npm install
```

### 2. Setup Supabase

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Apply migrations
npx supabase db push

# Deploy Edge Functions
npx supabase functions deploy import-emails
npx supabase functions deploy move-emails
npx supabase functions deploy bulk-actions
npx supabase functions deploy unsubscribe-email
```

### 3. Configure Environment Variables

Create `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (from Google Cloud Console)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
```

Create `supabase/.env` for Edge Functions:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Gmail OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# MCP Server (optional, for Puppeteer automation)
MCP_SERVER_URL=https://your-mcp-server.onrender.com

# Supabase (auto-populated)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Setup MCP Server (Optional)

```bash
cd mcp-server
npm install
npm run build

# Test locally
npm start
# Server runs on http://localhost:3001
```

### 5. Run Development Server

```bash
npm run dev
# Opens on http://localhost:5173
```

---

## 🌐 Deployment

### Frontend (Render Static Site)

1. Connect GitHub repo to Render
2. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Add environment variables (see above)
4. Deploy

**SPA Routing**: Add `public/_redirects` file:
```
/*    /index.html   200
```

### MCP Server (Render Web Service)

1. Create new Web Service on Render
2. Settings:
   - **Build Command**: `cd mcp-server && npm install && npm run build`
   - **Start Command**: `node mcp-server/dist/server.js`
   - **Environment**: Docker (for Puppeteer dependencies)
3. Add `MCP_SERVER_URL` to Edge Functions secrets
4. Deploy

### Edge Functions (Supabase)

```bash
# Deploy all functions
npx supabase functions deploy

# Set secrets
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set GOOGLE_CLIENT_ID=...
npx supabase secrets set GOOGLE_CLIENT_SECRET=...
npx supabase secrets set MCP_SERVER_URL=https://...
```

---

## 🔐 Environment Variables

### Frontend (`.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | `eyJhbGc...` |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID | `123-abc.apps.googleusercontent.com` |
| `VITE_GOOGLE_CLIENT_SECRET` | OAuth secret | `GOCSPX-...` |
| `VITE_GOOGLE_REDIRECT_URI` | OAuth callback | `http://localhost:5173/auth/callback` |

### Edge Functions (`supabase/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | `123-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | `GOCSPX-...` |
| `MCP_SERVER_URL` | Puppeteer server URL | `https://mcp.onrender.com` |
| `SUPABASE_URL` | Auto-set by Supabase | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase | `eyJhbGc...` |

---

## 📡 API Documentation

### Edge Functions

#### `import-emails`
**Endpoint**: `POST /functions/v1/import-emails`

**Purpose**: Sync emails from Gmail and categorize with AI

**Request**:
```json
{
  "accountId": "uuid",
  "maxEmails": 500
}
```

**Response**:
```json
{
  "success": true,
  "imported": 47,
  "categorized": 47,
  "errors": []
}
```

#### `bulk-actions`
**Endpoint**: `POST /functions/v1/bulk-actions`

**Purpose**: Execute delete or unsubscribe on multiple emails

**Request**:
```json
{
  "action": "unsubscribe",
  "emailIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "results": [
    {
      "emailId": "uuid1",
      "status": "success",
      "method": "http",
      "target": "https://example.com/unsubscribe"
    },
    {
      "emailId": "uuid2",
      "status": "error",
      "method": "manual",
      "error": "CAPTCHA required"
    }
  ]
}
```

#### `move-emails`
**Endpoint**: `POST /functions/v1/move-emails`

**Purpose**: Move emails between categories

**Request**:
```json
{
  "emailIds": ["uuid1", "uuid2"],
  "targetCategoryId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "moved": 2
}
```

### Database Schema

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `gmail_accounts`
```sql
CREATE TABLE gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `categories`
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  email_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `emails`
```sql
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  gmail_account_id UUID REFERENCES gmail_accounts(id),
  category_id UUID REFERENCES categories(id),
  gmail_id TEXT UNIQUE NOT NULL,
  from_email TEXT,
  subject TEXT,
  content_text TEXT,
  content_html TEXT,
  ai_summary TEXT,
  date TIMESTAMPTZ,
  is_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `unsubscribe_logs`
```sql
CREATE TABLE unsubscribe_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id),
  user_id UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('success', 'error', 'pending')),
  unsubscribe_method TEXT,
  unsubscribe_target TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Add comments for complex logic
- Write descriptive commit messages

### Testing
- Test all changes locally before submitting
- Ensure Edge Functions deploy successfully
- Verify RLS policies work correctly

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenAI** - GPT models for AI intelligence
- **Supabase** - Backend infrastructure
- **Puppeteer** - Browser automation
- **Google** - Gmail API access
- **Render** - Hosting platform

---

## 📞 Contact

**Project Maintainer**: [Your Name]

**Email**: your.email@example.com

**GitHub**: [@yourusername](https://github.com/yourusername)

---

## 🗺️ Roadmap

- [ ] **Email Templates**: AI-generated response templates
- [ ] **Scheduling**: Schedule emails for later
- [ ] **Advanced Filters**: Complex email filtering rules
- [ ] **Analytics Dashboard**: Email statistics and insights
- [ ] **Mobile App**: Native iOS/Android apps
- [ ] **Outlook Support**: Extend beyond Gmail
- [ ] **Team Features**: Shared accounts and categories
- [ ] **API Access**: Public API for integrations

---

**Built with ❤️ using React, TypeScript, Supabase, and OpenAI**
