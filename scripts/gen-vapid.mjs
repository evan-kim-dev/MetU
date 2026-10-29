/**
 * Generate VAPID keys for web push. Run locally only; add values to Vercel env.
 * Usage: node scripts/gen-vapid.mjs
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Add these to your server env (do not commit):");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
