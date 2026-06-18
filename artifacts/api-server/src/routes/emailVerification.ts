import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { isAuthenticated } from "../auth/replitAuth.js";
import { sendVerificationEmail } from "../lib/mailer.js";

const router = Router();

router.get("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ message: "Token không hợp lệ" });

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.emailVerificationToken, token),
          gt(users.emailVerificationExpiry, new Date())
        )
      )
      .limit(1);

    if (!user) {
      return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    if (user.emailVerified) {
      return res.json({ message: "Email đã được xác thực trước đó." });
    }

    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return res.json({ message: "Xác thực email thành công!" });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/auth/resend-verification", isAuthenticated, async (req: any, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!user) return res.status(404).json({ message: "Tài khoản không tồn tại" });
    if (user.emailVerified) return res.status(400).json({ message: "Email đã được xác thực rồi" });
    if (!user.email) return res.status(400).json({ message: "Tài khoản không có email" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .update(users)
      .set({ emailVerificationToken: token, emailVerificationExpiry: expiry })
      .where(eq(users.id, user.id));

    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:5000`;
    const verifyUrl = `${domain}/verify-email?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      await sendVerificationEmail(user.email, verifyUrl, user.username ?? user.firstName ?? "Người dùng");
      return res.json({ message: "Đã gửi lại email xác thực." });
    } else {
      return res.json({
        message: "Email chưa cấu hình. Dùng link bên dưới để xác thực.",
        devToken: token,
        verifyUrl,
      });
    }
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

export default router;
