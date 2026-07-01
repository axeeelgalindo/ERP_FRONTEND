import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - files with an extension (e.g. .png, .jpg, .webp, .css)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|.*\\..*).*)",
  ],
};
