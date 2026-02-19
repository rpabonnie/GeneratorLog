export default async function globalSetup() {
  const res = await fetch('http://localhost:3000/api/auth/me');
  if (res.status !== 401 && !res.ok) {
    throw new Error(`Backend health check failed: HTTP ${res.status}`);
  }
}
