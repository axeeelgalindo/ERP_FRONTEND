"use client";

import { useState } from "react";
import Image from "next/image";
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
      <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 420, borderRadius: 3 }}>
        <Stack component="form" onSubmit={onSubmit} spacing={2.5}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 1 }}>
            <Image
              src="/Logo_blue.webp"
              alt="Logo Blue Ingeniería"
              width={160}
              height={42}
              className="h-10 w-auto object-contain mb-2"
              priority
            />
            <Typography variant="h5" fontWeight={700} textAlign="center" color="#1e3a8a">
              Iniciar sesión
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 0.5 }}>
              Ingresa tus credenciales de acceso
            </Typography>
          </Box>

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
