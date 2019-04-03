import {
  Account,
  NetworkType,
  PublicAccount,
} from 'nem2-sdk';

import { sha3_256 } from 'js-sha3';

export const nemAccountService = {

  generatePublicKey(id: string): string {
    const publickey = sha3_256(id).toUpperCase();
    return publickey;
  },

  getPublicAccountFromPublicKey(publickey: string): PublicAccount {
    return PublicAccount.createFromPublicKey(publickey, NetworkType.MIJIN_TEST);
  },

  getDeterministicPublicAccount(id: string): PublicAccount {
    const publickey = sha3_256(id).toUpperCase();
    const publicAccount = PublicAccount.createFromPublicKey(publickey, NetworkType.MIJIN_TEST);
    return publicAccount;
  },

  getAccountFromPrivateKey(privateKey: string): Account {
    const networkType = NetworkType.MIJIN_TEST;
    return Account.createFromPrivateKey(privateKey, networkType);
  }
}