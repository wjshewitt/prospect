# LandVision - AI-Powered Land Development Platform

**ALWAYS follow these instructions first. Only fallback to search, bash commands, or additional exploration when the information here is incomplete or found to be incorrect.**

LandVision is a NextJS-based web application that provides AI-powered land analysis, GIS visualization, and development planning tools. It combines Google Maps integration, Firebase authentication, geospatial analysis, and machine learning to help real estate developers, urban planners, and land analysts make data-driven decisions.

## Working Effectively

### Bootstrap the Development Environment
**NEVER CANCEL any of these commands. Set explicit timeouts as shown:**

```bash
# Check prerequisites
node --version    # Should be 20.x
npm --version     # Should be 10.x

# Install dependencies - NEVER CANCEL - Takes up to 60 seconds
npm install --legacy-peer-deps    # REQUIRED: Use --legacy-peer-deps due to peer dependency conflicts
# TIMEOUT: 120 seconds minimum

# Build the application - NEVER CANCEL - Takes 30-60 seconds  
npm run build
# TIMEOUT: 120 seconds minimum

# Start development server - Ready in ~1.4 seconds
npm run dev
# Application available at http://localhost:3000
```

### Environment Configuration
**CRITICAL**: Create `.env.local` file with required environment variables:

```bash
# Firebase configuration (required for authentication)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google Maps API key (required for location features)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**For development without real services**: Use test values to enable builds:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=test_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=test.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=test-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=test-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:test
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=test_google_maps_key
```

### Build and Deploy Commands

```bash
# Type checking (shows errors but doesn't fail builds) - 10 seconds
npm run typecheck
# Note: Shows ~106 TypeScript errors but builds succeed due to configuration

# Production build - NEVER CANCEL - Takes 30-60 seconds
npm run build
# TIMEOUT: 120 seconds minimum

# Start production server - Ready in ~400ms
npm run start
# Requires successful build first

# Linting (interactive setup required)
npm run lint
# First run requires selecting ESLint configuration
```

### Docker Development (Alternative Setup)

```bash
# Modern docker compose (not docker-compose)
docker compose up -d
# Services:
# - NextJS frontend: http://localhost:3000
# - Python flood service: http://localhost:5000
```

### AI Development Tools

```bash
# Start Genkit AI development server
npm run genkit:dev

# Watch mode for AI flows
npm run genkit:watch
```

## Validation Scenarios

**ALWAYS manually validate changes using these complete user scenarios:**

### 1. Landing Page Validation
- Navigate to `http://localhost:3000`
- Verify LandVision branding and navigation load
- Click "Sign In" and "Sign Up" links
- Confirm landing page animations and content display properly

### 2. Authentication Flow Testing  
- Access `/login` and `/signup` pages
- Verify forms render correctly (Firebase errors expected with test credentials)
- Test navigation between auth pages

### 3. Development Features Testing
- **Location Preview**: Visit `/dev/location-preview`
  - Should show Google Maps integration (may fail with test API key)
  - Verify error messages display helpful guidance
  - Test form inputs and retry functionality

- **Demographics Testing**: Visit `/dev/demographics-test`  
  - Click "Fetch Data" button
  - Verify API calls execute (404 errors expected)
  - Confirm UI updates correctly show click count and error messages

### 4. Main Application Access
- Access `/vision` (requires authentication)
- Without valid Firebase config, should redirect to login
- With valid auth, should load the main GIS interface

## Build Timing and Expectations

**CRITICAL TIMING INFORMATION - NEVER CANCEL THESE OPERATIONS:**

- **Dependency Installation**: 45-60 seconds (TIMEOUT: 120 seconds)
- **First Build**: 45-60 seconds (TIMEOUT: 120 seconds)  
- **Subsequent Builds**: 20-35 seconds (TIMEOUT: 90 seconds)
- **Development Server Start**: 1-2 seconds
- **Production Server Start**: <1 second (after build)
- **Type Check**: 8-12 seconds
- **Hot Reload**: <1 second during development

## Common Development Tasks

### Working with Maps and GIS Features
- Main GIS interface at `/vision` (requires auth)
- Google Maps integration uses Places API, Geocoding API, Maps JavaScript API
- Mapbox token already configured in `next.config.ts`
- Test map features using `/dev/location-preview`

### Firebase Integration
- Authentication provider in `src/components/auth/firebase-auth-provider.tsx`
- Firebase config in `src/lib/firebase.ts`
- Firestore persistence enabled for offline support

### TypeScript Development
- **IMPORTANT**: TypeScript errors do not prevent builds (intentionally configured)
- Run `npm run typecheck` to see all TypeScript issues
- Focus on new errors you introduce, not existing ones
- 106+ existing TypeScript errors are known and acceptable

### API Development
- API routes in `src/app/api/`
- Demographics API: `/api/ons/demographics`
- UK flood data: `/api/uk-geoai/flood`
- Local authorities: `/api/local-authorities`
- Mapbox proxy: `/api/mapbox-proxy`

## Troubleshooting

### Dependency Issues
- **Error**: `ERESOLVE could not resolve` → **Solution**: Use `npm install --legacy-peer-deps`
- **Error**: Build fails with Firebase auth errors → **Solution**: Add `.env.local` with test credentials

### Map Integration Issues  
- **Error**: "Map failed to initialize" → **Solution**: Check Google Maps API key in `.env.local`
- **Error**: Maps load but show "development purposes only" → **Solution**: Configure API key restrictions in Google Cloud Console

### Build Issues
- **Error**: "No production build found" → **Solution**: Run `npm run build` before `npm run start`
- **Warning**: Handlebars webpack warnings → **Expected**: Known issue, does not affect functionality

### Development Server Issues
- **Error**: Port 3000 in use → **Solution**: Kill existing process or use different port
- **Error**: Fast refresh not working → **Solution**: Clear `.next` folder and rebuild

## Key Project Structure

### Source Code Organization
```
src/
├── app/                  # Next.js app router pages
│   ├── api/             # API routes
│   ├── dev/             # Development test pages
│   ├── login/           # Authentication pages
│   └── vision/          # Main application
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── map/            # GIS and mapping components
│   └── sidebar/        # UI panels and controls
├── lib/                # Utility libraries
├── services/           # Business logic services
└── ai/                 # AI and Genkit integration
```

### Configuration Files
- `next.config.ts` - Next.js configuration with Mapbox token
- `tailwind.config.ts` - Tailwind CSS theming
- `tsconfig.json` - TypeScript configuration
- `docker-compose.yml` - Multi-service development setup
- `package.json` - Dependencies and scripts

### Important Dependencies
- **Mapping**: `@react-google-maps/api`, `mapbox-gl`, `@turf/turf`
- **UI Framework**: `@radix-ui/*` components, `tailwindcss`
- **Firebase**: `firebase`, `firebase-admin`
- **AI/ML**: `genkit`, `@genkit-ai/googleai`
- **Geospatial**: `deck.gl`, `proj4`

## Testing and Quality Assurance

### Manual Testing Checklist
**ALWAYS complete these steps after making changes:**

- [ ] Run `npm install --legacy-peer-deps` if dependencies changed
- [ ] Execute `npm run build` to verify build succeeds  
- [ ] Start `npm run dev` and test development server
- [ ] Visit `/` and verify landing page loads completely
- [ ] Navigate to `/dev/location-preview` and test form interactions
- [ ] Check `/dev/demographics-test` and click "Fetch Data" button
- [ ] Attempt `/vision` access to verify auth redirection
- [ ] Review browser console for new errors (ignore Firebase/Maps errors with test credentials)

### Pre-commit Validation
- **ALWAYS run** `npm run typecheck` to check for new TypeScript errors
- **Consider running** `npm run lint` if ESLint is configured
- **Test build process** with `npm run build` before pushing changes

## Performance Considerations

- Development server includes hot reload and fast refresh
- Production builds are optimized and significantly smaller
- Static pages are pre-rendered where possible
- Large bundle size (~1.48MB) for `/vision` due to mapping libraries
- Use lazy loading for heavy components when possible

---

**Remember**: This application requires external API keys for full functionality. Development and testing can proceed with placeholder values, but production deployment requires valid Firebase and Google Maps configurations.