import {
  MosaicId, Transaction,
} from 'nem2-sdk';
import { nemAccountService } from '../services/nem.account.service';

// Profile stored correctly
// default->
//         Network:        MIJIN_TEST
// http://54.178.241.129:3000
// New Account:    SA6CSB-C2GHDO-RFBY4I-SAMLPE-DBHF7R-T6QUQR-5D5Q
// Public Key:     F227B3268481DF7F9825CFB7C2051F441A9BC0C65FA0AA2CF3A438C4B3177B81
// Private Key:    54B494F5BBCE235D753E609EC460C69947495280D8DE381579E3F15BE4CF81CA

export const nemElectoralCommission = {
  getElectoralCommissionPrivateKey() {
    return '54B494F5BBCE235D753E609EC460C69947495280D8DE381579E3F15BE4CF81CA';
  },

  validateTransaction(transaction: Transaction) {
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(this.getElectoralCommissionPrivateKey());
    return transaction.signer.equals(electoralCommissionAccount.publicAccount);
  }
}