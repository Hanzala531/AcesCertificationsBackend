import crypto from "crypto";

const key = "N4cR8uJ0yB3wE5aK9nX2rP6hS0dF4gJ8lC1mV5uR7tY0pQ9mT2vL6pZ1sH7k";
const payload = "-OmX3T8IvEJwVtyU.a7Fl_PXsvBb3VMfaBEq5VA.LuZbKOfPFA9jt0I870kubEL0Lx2i8sgDjCSAYxvLKXaCupxuSaAsCz0hTh-GWHXk1a6KlzVMYnuL3Y1g3n-iIzORHYZvoIm2l6tz1A1rV926czqNR-UUJ-4W8SjYIXGrp__iq1GnCh5B0FvHI0npgrvqqAbCgpLYyY-0MZeYJY1jCe7lZilaKo8-ukd_DvC-Ngpb42hh3HbbkAtxyt7sUNoeb4y2g_06Tl8";

function fromBase64(base64) {
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

async function decrypt() {
  const parts = payload.split(".");
  const iv = fromBase64(parts[0]);
  const p1 = fromBase64(parts[1]);
  const p2 = fromBase64(parts[2]);
  const hash = crypto.createHash("sha256").update(key.trim()).digest();

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", hash, iv);
    decipher.setAuthTag(p1);
    let decrypted = decipher.update(p2, "binary", "utf8");
    decrypted += decipher.final("utf8");
    console.log("Decrypted (Candidate A):");
    try {
      const json = JSON.parse(decrypted);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(decrypted);
    }
    return;
  } catch (e) {
    // Try candidate B
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", hash, iv);
    decipher.setAuthTag(p2);
    let decrypted = decipher.update(p1, "binary", "utf8");
    decrypted += decipher.final("utf8");
    console.log("Decrypted (Candidate B):");
    try {
      const json = JSON.parse(decrypted);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(decrypted);
    }
    return;
  } catch (e) {
    // Both failed
  }

  console.log("Both candidates failed to decrypt.");
}

decrypt().catch(console.error);
