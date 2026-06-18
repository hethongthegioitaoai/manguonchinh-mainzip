import { Resend } from "resend";

const EMAIL_FROM = "AI World System <onboarding@resend.dev>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string, username: string) {
  await getResend().emails.send({
    from: EMAIL_FROM,
    to: toEmail,
    subject: "✉ Xác thực email — AI World System",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Courier New',monospace;">
  <div style="max-width:500px;margin:40px auto;background:linear-gradient(135deg,#000d14,#0a0018);border:1px solid rgba(0,255,240,0.25);padding:40px;">
    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:rgba(0,255,240,0.5);font-size:10px;letter-spacing:0.5em;text-transform:uppercase;margin:0 0 8px">◈ NEURAL_GATEWAY v4.0.1 ◈</p>
      <h1 style="color:#00fff0;font-size:22px;letter-spacing:0.2em;margin:0;text-shadow:0 0 20px rgba(0,255,240,0.6)">AI WORLD SYSTEM</h1>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#00fff0,#b000ff,transparent);margin:12px 0 0"></div>
    </div>
    <p style="color:rgba(0,255,240,0.7);font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 8px">KÍCH HOẠT TÀI KHOẢN</p>
    <h2 style="color:#fff;font-size:18px;margin:0 0 20px">Xác thực địa chỉ email</h2>
    <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 24px">
      Xin chào <strong style="color:#00fff0">${username}</strong>,<br><br>
      Cảm ơn bạn đã đăng ký AI World System!<br>
      Nhấn nút bên dưới để xác thực email. Liên kết có hiệu lực trong <strong>24 giờ</strong>.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,rgba(0,255,240,0.1),rgba(100,0,200,0.15));border:1px solid rgba(0,255,240,0.5);color:#00fff0;text-decoration:none;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;font-weight:bold;box-shadow:0 0 20px rgba(0,255,240,0.2)">
        ✉ XÁC THỰC EMAIL
      </a>
    </div>
    <p style="color:rgba(255,255,255,0.35);font-size:11px;line-height:1.6;margin:24px 0 0;border-top:1px solid rgba(0,255,240,0.1);padding-top:16px">
      Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.<br>
      Hoặc copy URL: ${verifyUrl}
    </p>
  </div>
</body>
</html>`,
    text: `AI World System — Xác thực email\n\nXin chào ${username},\n\nNhấn link sau để xác thực email (hiệu lực 24 giờ):\n${verifyUrl}`,
  });
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string, username: string) {
  await getResend().emails.send({
    from: EMAIL_FROM,
    to: toEmail,
    subject: "⚡ Đặt lại mật khẩu — AI World System",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Courier New',monospace;">
  <div style="max-width:500px;margin:40px auto;background:linear-gradient(135deg,#000d14,#0a0018);border:1px solid rgba(0,255,240,0.25);padding:40px;">
    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:rgba(0,255,240,0.5);font-size:10px;letter-spacing:0.5em;text-transform:uppercase;margin:0 0 8px">◈ NEURAL_GATEWAY v4.0.1 ◈</p>
      <h1 style="color:#00fff0;font-size:22px;letter-spacing:0.2em;margin:0;text-shadow:0 0 20px rgba(0,255,240,0.6)">AI WORLD SYSTEM</h1>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#00fff0,#b000ff,transparent);margin:12px 0 0"></div>
    </div>
    <p style="color:rgba(0,255,240,0.7);font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 8px">XÁC THỰC THẦN KINH</p>
    <h2 style="color:#fff;font-size:18px;margin:0 0 20px">Đặt lại mật khẩu</h2>
    <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 24px">
      Xin chào <strong style="color:#00fff0">${username}</strong>,<br><br>
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.<br>
      Nhấn nút bên dưới để tiếp tục. Liên kết có hiệu lực trong <strong>30 phút</strong>.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,rgba(0,255,240,0.1),rgba(100,0,200,0.15));border:1px solid rgba(0,255,240,0.5);color:#00fff0;text-decoration:none;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;font-weight:bold;box-shadow:0 0 20px rgba(0,255,240,0.2)">
        ⚡ ĐẶT LẠI MẬT KHẨU
      </a>
    </div>
    <p style="color:rgba(255,255,255,0.35);font-size:11px;line-height:1.6;margin:24px 0 0;border-top:1px solid rgba(0,255,240,0.1);padding-top:16px">
      Nếu bạn không yêu cầu điều này, hãy bỏ qua email này. Liên kết sẽ tự hết hạn sau 30 phút.<br>
      Hoặc copy URL: ${resetUrl}
    </p>
  </div>
</body>
</html>`,
    text: `AI World System — Đặt lại mật khẩu\n\nXin chào ${username},\n\nNhấn link sau để đặt lại mật khẩu (hiệu lực 30 phút):\n${resetUrl}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
  });
}
