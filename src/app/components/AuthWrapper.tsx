"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthWrapper({
  children,
}: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleFetchError = async (response: Response) => {
      if (response.status === 403) {
        const data = await response.json();
        console.log("Received 403:", data);
        router.push("/unauthorized");
      }
    };

    // Add global fetch error handler
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (!response.ok) {
        await handleFetchError(response);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return children;
}
