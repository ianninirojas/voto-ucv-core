import {
  Transaction,
} from 'nem2-sdk';

import { nemAccountService } from '../services/nem.account.service';

// default->
//         Network:        MIJIN_TEST
//         Url:            http://54.178.241.129:3000
// New Account: SCXMI2OZU26476SECD6VZ7VAL37VKWQDVLPZK5CD
// Public Key: 142A40F3955792E4810C087B3EEB497BE3E27F755C29C140D964549478EBCBEC
// Private Key: 62C16BF741054567DD834F5670723DAB7031B114F919B2ECBA1D395F2F9F7B86

export const nemElectoralCommission = {
  getElectoralCommissionPrivateKey() {
    return '62C16BF741054567DD834F5670723DAB7031B114F919B2ECBA1D395F2F9F7B86';
  },

  validateTransaction(transaction: Transaction) {
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(this.getElectoralCommissionPrivateKey());
    return transaction.signer.equals(electoralCommissionAccount.publicAccount);
  }
}