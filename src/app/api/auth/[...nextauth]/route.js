// src/app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_DEBUG = process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        correo:     { label: "Correo",     type: "text" },
        contrasena: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const res = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            correo: credentials?.correo,
            contrasena: credentials?.contrasena,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = json?.msg || json?.message || `Login error (${res.status})`;
          throw new Error(msg);
        }

        const { token, user } = json; // ← backend: { token, user }

        // user esperado desde tu backend:
        // {
        //   sub, userId, nombre, correo,
        //   rol: { id, nombre, codigo },
        //   empresa: { id, nombre }  // puede venir null si MASTER
        // }

        const empresaId   = user?.empresa?.id ?? null;
        const empresaNombre = user?.empresa?.nombre ?? null;
        const rolCodigo   = String(user?.rol?.codigo || "").toUpperCase();
        const rolNombre   = user?.rol?.nombre ?? null;
        const isMaster    = rolCodigo === "MASTER";

        const mapped = {
          id: user?.userId ?? user?.sub ?? user?.id ?? null,
          name: user?.nombre ?? "",
          email: user?.correo ?? null,
          accessToken: token,
          empresaId,
          empresaNombre,
          rolCodigo,
          rolNombre,
          isMaster,
        };

        if (AUTH_DEBUG) console.log("[authorize] mapped:", mapped);
        return mapped;
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken   = user.accessToken;
        token.empresaId     = user.empresaId ?? null;
        token.empresaNombre = user.empresaNombre ?? null;
        token.rolCodigo     = user.rolCodigo ?? null;
        token.rolNombre     = user.rolNombre ?? null;
        token.isMaster      = Boolean(user.isMaster);
      }
      if (AUTH_DEBUG) console.log("[jwt] token:", token);
      return token;
    },

    async session({ session, token }) {
      session.user.accessToken   = token.accessToken;
      session.user.empresaId     = token.empresaId ?? null;
      session.user.empresaNombre = token.empresaNombre ?? null;
      session.user.rolCodigo     = token.rolCodigo ?? null;
      session.user.rolNombre     = token.rolNombre ?? null;
      session.user.isMaster      = Boolean(token.isMaster);

      if (AUTH_DEBUG) console.log("[session] session.user:", session.user);
      return session;
    },
  },

  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST, authOptions };
