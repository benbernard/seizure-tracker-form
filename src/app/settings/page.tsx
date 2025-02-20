"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ClientSettings from "./ClientSettings";

export default function SettingsPage() {
  const { isLoaded, userId, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (!isLoaded || !isSignedIn) {
        router.push("/sign-in?redirect_url=/settings");
        return;
      }

      // Check if user is in allowlist
      try {
        const response = await fetch("/api/check-auth");
        if (!response.ok) {
          router.push("/unauthorized");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/unauthorized");
      }
    };

    checkAuth();
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return <div>Loading...</div>;
  }

  return <ClientSettings />;
}
