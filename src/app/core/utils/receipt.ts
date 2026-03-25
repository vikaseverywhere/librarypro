export function generateReceiptNumber(now: Date = new Date()): string {
  // Format: RCPT-YYYYMMDD-HHMMSS-XXXX
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  const alphaNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphaNum[Math.floor(Math.random() * alphaNum.length)];
  }

  return `RCPT-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${suffix}`;
}

