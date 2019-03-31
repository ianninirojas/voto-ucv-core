import {
  Account,
  NetworkType,
  PublicAccount,
} from 'nem2-sdk';

import { sha3_256 } from 'js-sha3';

export const nemAccountService = {

  generatePublicKey(id: string): string {
    const publicKey = sha3_256(id).toUpperCase();
    return publicKey;
  },

  getPublicAccountFromPublicKey(publicKey: string): PublicAccount {
    return PublicAccount.createFromPublicKey(publicKey, NetworkType.MIJIN_TEST);
  },

  getDeterministicPublicAccount(id: string): PublicAccount {
    const publicKey = sha3_256(id).toUpperCase();
    const publicAccount = PublicAccount.createFromPublicKey(publicKey, NetworkType.MIJIN_TEST);
    return publicAccount;
  },

  getAccountFromPrivateKey(privateKey: string): Account {
    const networkType = NetworkType.MIJIN_TEST;
    return Account.createFromPrivateKey(privateKey, networkType);
  }
}