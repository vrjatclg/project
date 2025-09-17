// General utility helpers (pure front-end)

export const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export const debounce = (fn, wait = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

export const formatINR = (n) => {
  try {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n ?? 0);
  } catch {
    return (n ?? 0).toString();
  }
};

export const uid = (len = 20) => {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
};

// Generate a short, human-friendly payment code with checksum
// Format: 6 alphanumerics + 2 checksum (base36)
export const generatePaymentCode = (seed = '') => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid confusing chars
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let core = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  // checksum
  const data = new TextEncoder().encode(seed + core);
  return crypto.subtle.digest('SHA-256', data).then(buf => {
    const arr = Array.from(new Uint8Array(buf));
    const sum = (arr[0] << 8) + arr[1];
    const chk = (sum % 1296).toString(36).toUpperCase().padStart(2, '0'); // 36^2 = 1296
    return core + chk;
  });
};

export const nowTs = () => new Date();

export const toDateTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : ts;
  return d.toLocaleString();
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
