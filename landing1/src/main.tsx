import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route,  } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext'
import './index.css'
import App from './App.tsx'
import NyayaZephyrLanding from './NyayaZephyrLanding.tsx'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, SignIn, useUser } from '@clerk/clerk-react'
import { saveAuth, getStoredAuth } from './api/legalResearcher'

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

const API_BASE = "http://localhost:8000";

const AuthSyncWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      const syncUser = async () => {
        try {
          const auth = getStoredAuth();
          if (auth && auth.username === user.primaryEmailAddress?.emailAddress) {
            // Already synced and saved
            return;
          }
          
          const response = await fetch(`${API_BASE}/auth/clerk-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clerk_id: user.id,
              username: user.primaryEmailAddress?.emailAddress || user.username || `user_${user.id}`,
              email: user.primaryEmailAddress?.emailAddress
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            saveAuth({
              user_id: data.user_id,
              username: data.username,
             
            });
          }
        } catch (error) {
          console.error('Failed to sync clerk user:', error);
        }
      };
      syncUser();
    }
  }, [isLoaded, user]);

  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SignedIn>
        <AuthSyncWrapper>
          {children}
        </AuthSyncWrapper>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn signInFallbackRedirectUrl="/dashboard" />
      </SignedOut>
    </>
  );
};

const CustomSignInPage = () => {
  return (
    <div className="min-h-screen bg-[#f5f1e8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn 
          appearance={{
            elements: {
              card: "bg-white border text-[#1a1a1a] border-[#d4b896]/50 shadow-2xl rounded-sm",
              headerTitle: "text-[#1a1a1a] font-black tracking-wider text-xl font-serif",
              headerSubtitle: "text-[#8b7355] font-medium tracking-wide",
              socialButtonsBlockButton: "bg-white text-[#1a1a1a] border border-[#d4b896] hover:bg-[#f5f1e8] shadow-sm",
              socialButtonsBlockButtonText: "text-[#1a1a1a] font-black uppercase tracking-wider text-xs",
              dividerLine: "bg-[#d4b896]/50",
              dividerText: "text-[#8b7355] font-black uppercase tracking-widest text-xs",
              formFieldLabel: "text-[#1a1a1a] font-black uppercase tracking-wider text-xs",
              formFieldInput: "bg-white border-[#d4b896] text-[#1a1a1a] focus:border-[#f97316] focus:ring-[#f97316]/20 transition-all rounded-none",
              formButtonPrimary: "bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#f97316] font-black transition-all uppercase tracking-[0.2em] text-sm py-4 shadow-lg border border-[#f97316]/20 rounded-none",
              footerActionText: "text-[#8b7355] font-medium",
              footerActionLink: "text-[#f97316] hover:text-[#ea580c] font-black hover:underline"
            }
          }}
          fallbackRedirectUrl="/dashboard"
          routing="path" 
          path="/sign-in" 
        />
      </div>
    </div>
  )
}

const ClerkProviderWithRoutes = () => {
  
  return (
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY} 
      
    >
      <Routes>
        <Route path="/" element={<NyayaZephyrLanding />} />
        <Route path="/sign-in/*" element={<CustomSignInPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } />
      </Routes>
    </ClerkProvider>
  );
}

// Remove ApolloProvider temporarily to fix blank screen issue
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ClerkProviderWithRoutes />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)



