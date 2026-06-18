import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users, passwordResetTokens } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendPasswordResetEmail } from "../lib/mailer.js";

const router = Router();

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: "Vui lòng nhập email" });

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return res.json({ message: "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:5000`;
    const resetUrl = `${domain}/reset-password?token=${token}`;

    const emailConfigured = !!process.env.RESEND_API_KEY;

    if (emailConfigured) {
      await sendPasswordResetEmail(user.email!, resetUrl, user.username ?? user.firstName ?? "Người dùng");
      return res.json({ message: "Đã gửi email hướng dẫn đặt lại mật khẩu." });
    } else {
      return res.json({
        message: "Email chưa được cấu hình. Dùng token bên dưới để đặt lại mật khẩu.",
        devToken: token,
        resetUrl,
      });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) return res.status(400).json({ message: "Thiếu token hoặc mật khẩu" });
    if (password.length < 6) return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetToken) {
      return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return res.json({ message: "Đặt lại mật khẩu thành công!" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

export default router;
