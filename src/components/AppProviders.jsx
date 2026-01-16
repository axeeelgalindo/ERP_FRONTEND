"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: { mode: "light", primary: { main: "#1565C0" } },
  shape: { borderRadius: 12 },
  typography: { fontFamily: "Roboto, Arial, sans-serif" },
});

export default function AppProviders({ children }) {
  return (
    <SessionProvider>
      <AppRouterCacheProvider options={{ key: "mui" }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </SessionProvider>
  );
}
