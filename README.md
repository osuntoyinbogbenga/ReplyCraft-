# ReplyCraft-

A secure, production-ready AI chat application for generating natural, human-like message replies.

## Features

-  Secure JWT-based authentication
-  Multiple isolated chats per user
-  AI-powered reply generation using Claude
-  Fully responsive design (mobile, tablet, desktop)
-  Single-deployment architecture (Next.js App Router)
-  Complete data isolation and tenant security
-  Rate limiting and input validation

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Anthropic Claude Sonnet 4
- **Auth**: JWT with httpOnly cookies
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Setup your PostgreSQL database
4. Copy `.env.example` to `.env` and fill in values
5. Run migrations: `npx prisma migrate dev`
6. Start dev server: `npm run dev`

## Environment Variables
```env
DATABASE_URL="postgresql://..."
ANTHROPIC_API_KEY="sk-ant-..."
JWT_SECRET="your-secret-key"
NODE_ENV="production"
```

## Deployment

Deploy to Vercel in one click:
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

## Security

- All AI API calls happen server-side
- JWT authentication on all protected routes
- Rate limiting per user (50 requests/minute)
- Input sanitization and validation
- Complete data isolation between users and chats
