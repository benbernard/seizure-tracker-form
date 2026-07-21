"use client";

import {
  ClerkProvider as ClerkProviderRaw,
  SignIn as ClerkSignIn,
  SignUp as ClerkSignUp,
  useAuth as useClerkAuth,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
} from "react";

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | undefined;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isLoaded: false,
  isSignedIn: false,
  userId: undefined,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, signOut } = useClerkAuth();

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoaded: isLoaded ?? false,
      isSignedIn: isSignedIn ?? false,
      userId: userId || undefined,
      signOut: async () => {
        if (signOut) {
          await signOut();
        }
      },
    }),
    [isLoaded, isSignedIn, userId, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProviderRaw>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProviderRaw>
  );
}

export function LocalAuthProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoaded: true,
      isSignedIn: true,
      userId,
      signOut: async () => {
        router.push("/settings");
      },
    }),
    [userId, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function SignOutButton({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();

  if (isValidElement(children)) {
    return cloneElement(
      children as React.ReactElement<{ onClick?: () => void }>,
      {
        onClick: signOut,
      },
    );
  }

  return (
    <button type="button" onClick={signOut}>
      {children}
    </button>
  );
}

export { ClerkSignIn as SignIn, ClerkSignUp as SignUp };
