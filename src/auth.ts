import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const ALLOWED_EMAILS = new Set([
  'rnldusgpfla@gmail.com',
  'kyjune9993@gmail.com',
]);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      return ALLOWED_EMAILS.has(email);
    },
    async session({ session }) {
      return session;
    },
  },
  session: { strategy: 'jwt' },
  trustHost: true,
});
