// modules
let nem = require("nem-sdk").default;

import {
  PlainMessage,
} from 'nem2-sdk';

import { KECCAK256 } from 'apostille-library';

import * as CryptoJS from 'crypto-js';

export const apostilleService = {

  veriryApostille(data: any, hashedFileContentTransaction: any) {
    let hashedFileContentTransactionResponse = {
      type: hashedFileContentTransaction.type,
      message: PlainMessage.create(JSON.parse(hashedFileContentTransaction.message.payload).data.hash),
      signer: hashedFileContentTransaction.signer,
      otherTrans: PlainMessage.create('')
    }
    if (hashedFileContentTransaction.type === 4100) {
      hashedFileContentTransactionResponse.otherTrans = PlainMessage.create(JSON.parse(hashedFileContentTransaction.message.payload).data.hash);
    }
    return nem.model.apostille.verify(data, hashedFileContentTransactionResponse)
  },

  createHashApostille(data: string) {
    data = CryptoJS.enc.Utf8.parse(data);
    const hashFunction = new KECCAK256();
    const hash = hashFunction.nonSignedHashing(data);
    return hash;
  }
}