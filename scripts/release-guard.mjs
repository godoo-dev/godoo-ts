import { require18Proof, requireMainCandidate, verifyCandidate } from './check-lib.mjs';

const dir = process.env.CANDIDATE_DIR;
requireMainCandidate();
if (dir) {
  const manifest = verifyCandidate(dir);
  require18Proof(dir, manifest);
  // require18Proof also verifies installed package/consumer-lock and every executed suite hash.
}
