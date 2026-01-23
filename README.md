# 🎮 StandShell — Modular Game Platform

**StandShell** is a flexible, modular game platform designed for interactive experiences at events, fairs, and social gatherings. The platform features a core architecture that allows for infinite game implementations, each with its own custom UI, validation logic, and game mechanics.

## 🏗️ Architecture

StandShell is built with a **modular architecture** that separates core functionality from game-specific implementations:

```
StandShell
├── Core Components (Reusable across all games)
│   ├── AppShell.tsx       # Main application container with game selection
│   ├── GameGate.tsx       # Game creation and selection interface
│   ├── SettingsMenu.tsx   # Settings and game management
│   ├── Ranking.tsx        # Leaderboard component (optional per game)
│   ├── Quiz.tsx           # Quiz management system
│   ├── Raffle.tsx         # Raffle/sweepstakes system
│   ├── QRCode.tsx         # QR code generation component
│   ├── theme.tsx          # Dynamic theming system
│   └── types.ts           # TypeScript type definitions
│
└── Games (Modular, infinite games can be added)
    ├── empareja2/         # Pair matching game
    │   ├── config.ts      # Game configuration
    │   └── GameScreen.tsx  # Game-specific UI and logic
    ├── t1mer/             # Timer precision game
    │   ├── config.ts
    │   └── GameScreen.tsx
    └── [your-game]/        # Add your own game here!
        ├── config.ts
        └── GameScreen.tsx
```

## 🎯 Core Components

### AppShell
The main application container that:
- Manages game state and selection
- Provides the settings menu
- Handles game creation and navigation
- Displays game logos and branding
- Integrates optional ranking components

### Game System
Each game is completely modular and independent:
- **Game Definition**: Each game exports a `GameDefinition` object with:
  - `id`: Unique game identifier
  - `name`: Display name
  - `description`: Game description
  - `colors`: Custom theme colors (primary, accent, background, etc.)
  - `assets`: Game-specific assets (logos, images)
  - `GameScreen`: React component for the game UI
  - `showRanking`: Optional flag to enable leaderboard

- **GameScreen Component**: Each game implements its own `GameScreen` component that receives:
  - `gameId`: Current game instance ID
  - `gameName`: Current game instance name

## 🎮 Current Games

### Empareja2
A pair-matching game where players:
1. Scan a QR code to get their player code via Instagram DM
2. Find their assigned partner physically
3. Validate both codes together to win

**Features:**
- Instagram Direct integration for player codes
- Pair validation with visual feedback
- Character images from S3 bucket
- Winning animation with player images and usernames

### T1mer
A precision timing game where players:
1. Get their player code via Instagram DM
2. Start a hidden timer (disappears after 5 seconds)
3. Try to stop the timer exactly at 10 seconds
4. Score based on accuracy

**Features:**
- Real-time timer display
- Hidden timer mode
- Score calculation and ranking
- Instagram Direct integration

### L3tras
A word formation game where players:
- Form words using available letters
- Score based on word length and complexity
- Compete on leaderboard

### Rulet4
A configurable roulette game with:
- Customizable panels and options
- Real-time spinning mechanics
- Score tracking and ranking

## ➕ Adding a New Game

To add a new game to StandShell:

1. **Create game directory** in `src/games/your-game/`:
   ```bash
   mkdir -p src/games/your-game
   ```

2. **Create GameScreen component** (`src/games/your-game/GameScreen.tsx`):
   ```tsx
   import type { GameScreenProps } from '../../core/types'
   
   export default function YourGameScreen({ gameName, gameId }: GameScreenProps) {
     return (
       <div className="w-full space-y-6">
         {/* Your game UI here */}
       </div>
     )
   }
   ```

3. **Create game config** (`src/games/your-game/config.ts`):
   ```tsx
   import type { GameDefinition } from '../../core/types'
   import YourGameScreen from './GameScreen'
   
   export const yourGameDefinition: GameDefinition = {
     id: 'your-game',
     name: 'Your Game',
     description: 'Game description',
     colors: {
       primary: '#YOUR_COLOR',
       accent: '#YOUR_COLOR',
       background: '#0B0A12',
       surface: 'rgba(255,255,255,0.04)',
       textMain: '#EAEAF2',
       textSub: '#9AA0A6',
     },
     assets: {
       logo: '/your-game-logo.png',
       clientLogo: '/client-logo.png',
       standLogo: '/stand-logo.png',
     },
     GameScreen: YourGameScreen,
     showRanking: false, // Set to true if you want ranking
   }
   ```

4. **Register the game** in `src/games/index.ts`:
   ```tsx
   import { yourGameDefinition } from './your-game/config'
   
   export const games: GameDefinition[] = [
     empareja2Definition,
     t1merDefinition,
     yourGameDefinition, // Add your game here
   ]
   ```

5. **Add game assets** to `public/` directory (logos, images, etc.)

That's it! Your game will automatically appear in the game selection interface.

## 🔐 Authentication & User Management

StandShell uses **AWS Cognito OAuth2** with **PKCE (Proof Key for Code Exchange)** for secure authentication:

- **OAuth2 Authorization Code Flow** with PKCE for enhanced security
- **Session-based token storage** using `sessionStorage`
- **Automatic token refresh** and expiration handling
- **Protected routes** that redirect unauthenticated users to login
- **User bootstrap** on first login via backend API
- **Plan-based feature gating** (FREE, EVENT_24H, ENTERPRISE)

### User Plans

- **FREE**: Basic features, limited games and players
- **EVENT_24H**: Full access to all features for 24 hours
- **ENTERPRISE**: Unlimited access to all features

## 🚀 Technologies

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Styling with custom theming
- **React Router v6** — Client-side routing
- **AWS Cognito** — User authentication and authorization
- **AWS Lambda** — Backend API (game logic, validation, user management)
- **Amazon DynamoDB** — Game data storage
- **Amazon API Gateway** — REST API
- **Amazon S3** — Asset storage (character images)
- **Stripe** — Payment processing for plan upgrades
- **Meta Graph API** — Instagram Direct messaging

## 📦 Project Structure

```
StandShell/
├── public/                 # Static assets (logos, images)
├── src/
│   ├── auth/              # Authentication system
│   │   ├── AuthContext.tsx      # Auth state management
│   │   ├── AuthStart.tsx        # OAuth initiation
│   │   ├── AuthCallback.tsx     # OAuth callback handler
│   │   ├── ProtectedRoute.tsx   # Route protection
│   │   ├── useCurrentUser.ts    # User data hook
│   │   ├── authStorage.ts       # Token storage
│   │   ├── pkce.ts              # PKCE utilities
│   │   └── featureFlags.ts     # Plan-based features
│   ├── api/               # API client
│   │   └── api.ts         # Centralized API client with auth
│   ├── core/              # Core reusable components
│   │   ├── AppShell.tsx   # Main app container
│   │   ├── GameGate.tsx   # Game selection UI
│   │   ├── SettingsMenu.tsx
│   │   ├── Ranking.tsx
│   │   ├── Quiz.tsx
│   │   ├── Raffle.tsx
│   │   ├── QRCode.tsx
│   │   ├── theme.tsx      # Theming system
│   │   ├── logoUtils.ts   # Dynamic logo utilities
│   │   ├── AppearanceSettings.tsx # Appearance customization
│   │   └── types.ts       # TypeScript definitions
│   ├── games/             # Game implementations
│   │   ├── empareja2/
│   │   ├── t1mer/
│   │   ├── l3tras/
│   │   ├── rulet4/
│   │   └── index.ts       # Game registry
│   ├── pages/             # Page components
│   │   ├── Login.tsx      # Login page
│   │   ├── BillingSuccess.tsx
│   │   └── BillingCancel.tsx
│   ├── styles/
│   │   └── glow.css       # Global styles and animations
│   ├── App.tsx            # Main app with routing
│   └── main.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── .env                    # Environment variables (not in repo)
```

## 🎨 Theming System

Each game can define its own color scheme:
- **Primary color**: Main brand color
- **Accent color**: Secondary highlight color
- **Background**: Base background color
- **Surface**: Card/container background
- **Text colors**: Main and secondary text colors

The theming system uses CSS variables for dynamic color switching based on the active game.

### Appearance Customization

Users can customize the appearance of the platform:

- **Dark/Light Mode**: Toggle between dark and light themes (available for all plans)
- **Custom Color Palette**: Personalize primary and accent colors (EVENT_24H plan only)
- **Custom Logo**: Upload a custom logo (EVENT_24H plan only)
- **Dynamic Logo**: Logo automatically switches between white/black based on theme mode

The platform logo (`logo_stand_letters`) automatically adapts:
- **Dark mode**: Uses `logo_stand_letters_white.png`
- **Light mode**: Uses `logo_stand_letters_black.png`

## 🔧 Development

### Prerequisites

- Node.js 18+ and npm
- AWS Cognito User Pool configured
- Backend API deployed (AWS API Gateway + Lambda)

### Environment Variables

Create a `.env` file in the root directory:

```env
# AWS Cognito Configuration
VITE_COGNITO_DOMAIN=your-cognito-domain.auth.region.amazoncognito.com
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:5173/logout

# Backend API
VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod
```

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Authentication Flow

1. User clicks "Continuar" on login page
2. Redirects to `/auth/start` which generates PKCE parameters
3. Redirects to AWS Cognito OAuth2 authorization endpoint
4. User authenticates with Cognito
5. Cognito redirects to `/auth/callback` with authorization code
6. Frontend exchanges code for tokens using PKCE verifier
7. Tokens stored in `sessionStorage`
8. User bootstrapped via `POST /users` API
9. Redirects to `/app` (protected route)

## 📝 API Integration

Games and the application communicate with the backend API. The API base URL is configured via environment variable `VITE_API_BASE_URL`.

### Authentication

All API requests automatically include the ID token from AWS Cognito in the `Authorization: Bearer <token>` header. The API client (`src/api/api.ts`) handles:
- Automatic token injection
- Error handling (401 redirects to login)
- Network error handling
- CORS support

### Common Endpoints

**Game Management:**
- `/validate` — Validate game codes
- `/score` — Submit game scores
- `/game` — Game management
- `/quiz` — Quiz data

**User Management:**
- `POST /users` — Bootstrap user on first login
- `GET /users` — Get current user data (plan, email, etc.)

**Billing:**
- `POST /billing/checkout` — Create Stripe checkout session for plan upgrade

## 🎯 Features

### Core Features
- ✅ **Modular game system** — Add infinite games
- ✅ **Dynamic theming** — Each game has its own color scheme
- ✅ **Core components** — Reusable UI components
- ✅ **Settings menu** — Game management and configuration
- ✅ **Ranking system** — Optional leaderboards per game
- ✅ **QR code generation** — Built-in QR code component
- ✅ **Instagram integration** — Direct messaging support
- ✅ **Responsive design** — Works on all screen sizes

### Authentication & User Management
- ✅ **AWS Cognito OAuth2** — Secure authentication with PKCE
- ✅ **Protected routes** — Automatic redirect for unauthenticated users
- ✅ **User profiles** — View user information, plan, and account details
- ✅ **Session management** — Secure token storage and expiration handling

### Plan-Based Features
- ✅ **Feature flags** — Plan-based feature gating system
- ✅ **FREE plan** — Basic features (1 game, 25 players max)
- ✅ **EVENT_24H plan** — Full access for 24 hours (unlimited games/players)
- ✅ **ENTERPRISE plan** — Unlimited access to all features
- ✅ **Plan upgrades** — Stripe integration for plan activation

### Customization
- ✅ **Dark/Light mode** — Toggle theme (all plans)
- ✅ **Custom color palettes** — Personalize colors (EVENT_24H+)
- ✅ **Custom logo upload** — Brand customization (EVENT_24H+)
- ✅ **Dynamic logo** — Auto-switching logo based on theme

## 🔒 Security Features

- **PKCE (Proof Key for Code Exchange)** — Enhanced OAuth2 security
- **Session-based tokens** — Tokens stored in `sessionStorage` (cleared on tab close)
- **Automatic token expiration** — Handles token refresh and expiration
- **Protected routes** — Unauthenticated users redirected to login
- **CORS protection** — Backend handles CORS headers
- **Secure API communication** — All API requests include authentication tokens

## 📸 Screenshots

The platform supports multiple games with unique UIs and mechanics, all managed through a unified interface.
<img width="580" height="506" alt="image" src="https://github.com/user-attachments/assets/c4b21406-3524-4245-8b97-92b22a59a18a" />
<img width="907" height="646" alt="image" src="https://github.com/user-attachments/assets/13324ab0-5774-44f8-b868-c9521c28d7af" />
<img width="886" height="658" alt="image" src="https://github.com/user-attachments/assets/027b2ab9-4acf-41c6-acb2-3204987a46af" />



## 👤 Author

Developed by **Adria Sanchez Puig**

## 🛡️ License

MIT License © 2025 — Free to use and modify with attribution.
