import mysql from "mysql2/promise";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    const db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    await db.end();
    if (!user || password !== user.password) {
      return new Response(JSON.stringify({ match: false }), { status: 200 });
    }
    return new Response(JSON.stringify({ match: true, role: user.role }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ match: false }), { status: 200 });
  }
}
