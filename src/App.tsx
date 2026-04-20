import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import clsx from 'clsx';
import { FileText, Settings, LogOut, CheckSquare } from 'lucide-react';
import Admin from './pages/Admin';
import Wizard from './pages/Wizard';

function AppContent() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!active) return;
      setUser(u);
      
      if (u) {
        // Timeout to prevent app hanging if Firebase is slow/blocked
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Admin check timeout')), 5000)
        );

        try {
          const adminDocAction = getDoc(doc(db, 'admins', u.uid));
          const adminDoc = (await Promise.race([adminDocAction, timeoutPromise])) as any;
          if (adminDoc && adminDoc.exists()) {
            if (active) setIsAdmin(true);
          } else {
            try {
              await setDoc(doc(db, 'admins', u.uid), {
                email: u.email || 'unknown',
                createdAt: serverTimestamp()
              });
              if (active) setIsAdmin(true);
            } catch (e) {
              console.log("Not an admin.");
              if (active) setIsAdmin(false);
            }
          }
        } catch (error) {
           console.warn("Could not verify admin status:", error);
           if (active) setIsAdmin(false);
        }
      } else {
        if (active) setIsAdmin(false);
      }
      
      if (active) setLoading(false);
    });
    
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-bg-main"><p className="text-text-dim animate-pulse">Chargement...</p></div>;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-bg-main text-text-bright overflow-hidden">
        {/* Sidebar */}
        <div className="w-[240px] bg-bg-sidebar border-r border-border-dark flex flex-col shrink-0">
          <div className="p-6 border-b border-border-dark">
            <h2 className="text-[14px] font-bold text-accent uppercase tracking-[1px]">
              AWB • LEGAL ENGINE
            </h2>
          </div>
          
          <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
            <Link to="/wizard" className="flex items-center gap-3 px-6 py-3 text-[13px] text-text-dim hover:text-text-bright hover:bg-accent/10 border-l-[3px] border-transparent hover:border-accent transition-all">
              <CheckSquare className="h-4 w-4" />
              Nouveau Contrat
            </Link>
            
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-3 px-6 py-3 text-[13px] text-text-dim hover:text-text-bright hover:bg-accent/10 border-l-[3px] border-transparent hover:border-accent transition-all">
                <Settings className="h-4 w-4" />
                Administration
              </Link>
            )}
            
            {(!user || !isAdmin) && (
              <Link to="/admin" className="flex items-center gap-3 px-6 py-3 text-[13px] text-text-dim hover:text-text-bright hover:bg-accent/10 border-l-[3px] border-transparent hover:border-accent transition-all">
                <Settings className="h-4 w-4" />
                Accès Admin
              </Link>
            )}
          </nav>
          
          <div className="p-5 border-t border-border-dark bg-bg-sidebar">
            {user ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[13px] truncate">
                    <p className="text-text-bright truncate">{user.displayName || user.email}</p>
                    {isAdmin && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full mt-1.5 inline-block border border-accent/30 tracking-wide font-medium">ADMIN</span>}
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="w-full py-2 text-center bg-transparent border border-border-dark text-text-dim hover:text-text-bright rounded-md text-[13px] font-medium transition-colors"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <button 
                onClick={login}
                className="w-full py-2 text-center bg-accent text-black hover:opacity-90 rounded-md text-[13px] font-bold transition-colors"
              >
                Connexion Admin
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-bg-main">
          <Routes>
            <Route path="/" element={<Navigate to="/wizard" replace />} />
            <Route path="/wizard" element={<Wizard />} />
            <Route path="/admin" element={
              isAdmin ? <Admin /> : (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-bg-card border border-border-dark p-8 rounded-xl shadow-lg w-full max-w-md text-center">
                    <h1 className="text-2xl font-bold text-text-bright mb-6">Zone Administrateur</h1>
                    <p className="text-text-dim mb-8">Veuillez vous connecter avec un compte administrateur pour configurer les règles du moteur de contrats.</p>
                    {!user ? (
                      <button 
                        onClick={login}
                        className="w-full bg-accent hover:opacity-90 text-black font-semibold py-3 rounded-md transition-colors flex items-center justify-center gap-2"
                      >
                        Se connecter avec Google
                      </button>
                    ) : (
                      <div className="text-[#e74c3c] bg-[#e74c3c]/10 p-4 rounded-lg font-medium">
                        Votre compte n'est pas autorisé à accéder à cette zone.
                      </div>
                    )}
                  </div>
                </div>
              )
            } />
            <Route path="*" element={<Navigate to="/wizard" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppContent />;
}
