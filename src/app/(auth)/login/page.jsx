//src/app/(auth)/login/page.jsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Paper, Stack, TextField, Button, Typography, Alert, LinearProgress } from "@mui/material";

export default function LoginPage() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/";

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await signIn("credentials", { redirect: false, correo, contrasena, callbackUrl });
    setLoading(false);
    if (res?.error) { setErr(res.error); return; }
    router.push(callbackUrl);
  }

  return (
    // 👇 importante: altura hereda del layout (no 100dvh)
    <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
      <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Stack component="form" onSubmit={onSubmit} spacing={2}>
          <Typography variant="h5" fontWeight={600} textAlign="center">
            Iniciar sesión
          </Typography>

          <TextField label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} fullWidth required />
          <TextField label="Contraseña" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} fullWidth required />

          {loading && <LinearProgress />}
          {err && <Alert severity="error">{err}</Alert>}

          <Button type="submit" variant="contained" size="large" disabled={loading}>
            Entrar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
