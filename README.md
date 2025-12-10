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

## 🚀 Technologies

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Styling with custom theming
- **AWS Lambda** — Backend API (game logic, validation)
- **Amazon DynamoDB** — Game data storage
- **Amazon API Gateway** — REST API
- **Amazon S3** — Asset storage (character images)
- **Meta Graph API** — Instagram Direct messaging

## 📦 Project Structure

```
StandShell/
├── public/                 # Static assets (logos, images)
├── src/
│   ├── core/              # Core reusable components
│   │   ├── AppShell.tsx   # Main app container
│   │   ├── GameGate.tsx   # Game selection UI
│   │   ├── SettingsMenu.tsx
│   │   ├── Ranking.tsx
│   │   ├── Quiz.tsx
│   │   ├── Raffle.tsx
│   │   ├── QRCode.tsx
│   │   ├── theme.tsx      # Theming system
│   │   └── types.ts       # TypeScript definitions
│   ├── games/             # Game implementations
│   │   ├── empareja2/
│   │   ├── t1mer/
│   │   └── index.ts       # Game registry
│   ├── styles/
│   │   └── glow.css       # Global styles and animations
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

## 🎨 Theming System

Each game can define its own color scheme:
- **Primary color**: Main brand color
- **Accent color**: Secondary highlight color
- **Background**: Base background color
- **Surface**: Card/container background
- **Text colors**: Main and secondary text colors

The theming system uses CSS variables for dynamic color switching based on the active game.

## 🔧 Development

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

## 📝 API Integration

Games communicate with the backend API at:
```
https://3u0n7y51m9.execute-api.us-east-1.amazonaws.com/prod
```

Common endpoints:
- `/validate` — Validate game codes
- `/score` — Submit game scores
- `/game` — Game management
- `/quizz` — Quiz data

## 🎯 Features

- ✅ **Modular game system** — Add infinite games
- ✅ **Dynamic theming** — Each game has its own color scheme
- ✅ **Core components** — Reusable UI components
- ✅ **Settings menu** — Game management and configuration
- ✅ **Ranking system** — Optional leaderboards per game
- ✅ **QR code generation** — Built-in QR code component
- ✅ **Instagram integration** — Direct messaging support
- ✅ **Responsive design** — Works on all screen sizes

## 📸 Screenshots

The platform supports multiple games with unique UIs and mechanics, all managed through a unified interface.
<img width="580" height="506" alt="image" src="https://github.com/user-attachments/assets/c4b21406-3524-4245-8b97-92b22a59a18a" />
<img width="907" height="646" alt="image" src="https://github.com/user-attachments/assets/13324ab0-5774-44f8-b868-c9521c28d7af" />
<img width="886" height="658" alt="image" src="https://github.com/user-attachments/assets/027b2ab9-4acf-41c6-acb2-3204987a46af" />



## 👤 Author

Developed by **Adria Sanchez Puig**

## 🛡️ License

MIT License © 2025 — Free to use and modify with attribution.
