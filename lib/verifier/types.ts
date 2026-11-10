export interface Frame { id: number; hash: string }
export interface Manifest { bookingId: string; frames: Frame[]; root: string }
export interface ReceivedFrame {
  id: number; hash: string; receivedAt: number; // epoch ms
  rssiDbm: number; dopplerHz: number;
}
export interface ReceiptBody {
  bookingId: string; stationId: string; manifestRoot: string;
  frames: ReceivedFrame[];
}
export interface Receipt extends ReceiptBody { signature: string; publicKey: string } // hex (ed25519 / SPKI DER)
export interface PassWindow { start: number; end: number; downlinkHz: number; maxDopplerHz: number }

export interface VerificationReport {
  promised: number; received: number; verified: number;
  missing: number[]; duplicates: number[];
  invalidHashes: { id: number; expected: string; got: string }[];
  timestampViolations: number[]; unknownFrames: number[];
  dopplerAnomalies: number[];
  signatureValid: boolean; manifestRootMatches: boolean;
  receivedRoot: string; // merkle root over verified frames (manifest order)
  deliveryBps: number; // 0..10000
  confidence: "high" | "medium" | "low";
  rejected?: string;
}
