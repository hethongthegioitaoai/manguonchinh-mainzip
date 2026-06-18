import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { isAuthenticated, getAuthUser } from "../auth/replitAuth.js";

const router = Router();

/* GET /api/auth/user */
router.get("/auth/user", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId;
    const user = await getAuthUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      emailVerified: user.emailVerified,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/* POST /api/auth/register */
router.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password, firstName } = req.body as {
      username?: string; email?: string; password?: string; firstName?: string;
    };

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      return res.status(400).json({ message: "Tên đăng nhập chỉ gồm chữ, số, gạch dưới (3-32 ký tự)" });
    }

    /* Check duplicate */
    const existing = await db.select().from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);
    if (existing.length > 0) {
      const dup = existing[0];
      if (dup.username === username) return res.status(409).json({ message: "Tên đăng nhập đã tồn tại" });
      return res.status(409).json({ message: "Email đã được sử dụng" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({
      username,
      email,
      passwordHash,
      firstName: firstName || username,
      emailVerified: false,
    }).returning();

    /* Set session */
    (req.session as any).userId = user.id;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      emailVerified: user.emailVerified,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ khi đăng ký" });
  }
});

/* POST /api/auth/login */
router.post("/auth/login", async (req, res) => {
  try {
    const { login, password } = req.body as { login?: string; password?: string };

    if (!login || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    /* Match by username OR email */
    const isEmail = login.includes("@");
    const [user] = await db.select().from(users)
      .where(isEmail ? eq(users.email, login) : eq(users.username, login))
      .limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    (req.session as any).userId = user.id;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      emailVerified: user.emailVerified,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ khi đăng nhập" });
  }
});

/* POST /api/auth/logout */
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Đã đăng xuất" });
  });
});

/* POST /api/logout — alias cho AuthContext.tsx */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Đã đăng xuất" });
  });
});

/* POST /api/auth/change-password */
router.post("/auth/change-password", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string; newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.passwordHash) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));

    return res.json({ message: "Đổi mật khẩu thành công!" });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

export default router;
