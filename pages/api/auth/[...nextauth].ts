import NextAuth, { type NextAuthOptions } from "next-auth";

const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = (token as any).id;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return baseUrl + url;
      }
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl + '/Proponent/welcome';
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login'
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);

