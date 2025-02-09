"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a single instance that can be reused
const queryClient = new QueryClient();

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Export the queryClient for use in other components
export { queryClient };
