// Base URL for the Locket gateway, including the `/api` path prefix.
// Override via EXPO_PUBLIC_GATEWAY_URL. On SDK 54 this resolves through Expo's
// generated `expo/virtual/env` module, populated from a local `.env` file — set it in
// apps/mobile/.env (NOT as an inline shell var, which does not take effect), then
// restart the bundler with `expo start -c`. See apps/mobile/.env.example.
// The value MUST include the `/api` suffix; a trailing slash is stripped so call
// sites can safely do `${GATEWAY_URL}/anchor`.
// Simulator: default localhost. Physical device: LAN IP, e.g.
//   EXPO_PUBLIC_GATEWAY_URL=http://192.168.0.164:3000/api
const RAW = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000/api';

export const GATEWAY_URL = RAW.replace(/\/+$/, '');
