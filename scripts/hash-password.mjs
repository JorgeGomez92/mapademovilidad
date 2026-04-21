#!/usr/bin/env node
// Genera un hash scrypt para poner en DASHBOARD_USERS.
// Uso: node scripts/hash-password.mjs "mi_contraseña"

import { scryptSync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash-password.mjs "contraseña"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt.${salt.toString("hex")}.${hash.toString("hex")}`);
