import * as crypto from "crypto";

export const codeService = {
  generateCode() {
    return crypto.randomBytes(8).toString('hex');
  }
}
