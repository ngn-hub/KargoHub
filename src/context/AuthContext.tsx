"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile, ClientAccount, UserRole } from "@/types";
import { DEMO_USERS, DEMO_CLIENTS } from "@/lib/services/seedService";

import { auth } from "@/lib/firebase/config";
import { signInWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

interface AuthContextType {
  currentUser: UserProfile;
  currentClient: ClientAccount | null;
  firebaseAuthUser: FirebaseUser | null;
  allUsers: UserProfile[];
  allClients: ClientAccount[];
  switchUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_USERS[1]); // Default to Client Owner (Metro Supermarket)
  const [currentClient, setCurrentClient] = useState<ClientAccount | null>(DEMO_CLIENTS[0]);
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<FirebaseUser | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseAuthUser(user);
    });
    return () => unsub();
  }, []);

  // Sync currentClient whenever currentUser changes & sign into Firebase Auth
  useEffect(() => {
    if (currentUser.clientAccountId) {
      const client = DEMO_CLIENTS.find((c) => c.id === currentUser.clientAccountId) || null;
      setCurrentClient(client);
    } else {
      setCurrentClient(null);
    }

    // Authenticate Firebase Auth session in background
    signInWithEmailAndPassword(auth, currentUser.email, "KargoHub2026!").catch(() => {
      // Background session handling
    });
  }, [currentUser]);

  const switchUser = (userId: string) => {
    const target = DEMO_USERS.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      signInWithEmailAndPassword(auth, target.email, "KargoHub2026!").catch(() => {});
    }
  };

  const switchRole = (role: UserRole) => {
    const target = DEMO_USERS.find((u) => u.role === role);
    if (target) {
      setCurrentUser(target);
      signInWithEmailAndPassword(auth, target.email, "KargoHub2026!").catch(() => {});
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentClient,
        firebaseAuthUser,
        allUsers: DEMO_USERS,
        allClients: DEMO_CLIENTS,
        switchUser,
        switchRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
