import {
  MosaicId, Transaction, TransactionMapping,
} from 'nem2-sdk';
import { nemAccountService } from '../services/nem.account.service';

// Profile stored correctly
// default->
//         Network:        MIJIN_TEST
// http://54.178.241.129:3000
// New Account:    SA6CSB-C2GHDO-RFBY4I-SAMLPE-DBHF7R-T6QUQR-5D5Q
// Public Key:     F227B3268481DF7F9825CFB7C2051F441A9BC0C65FA0AA2CF3A438C4B3177B81
// Private Key:    54B494F5BBCE235D753E609EC460C69947495280D8DE381579E3F15BE4CF81CA

// default->
//         Network:        MIJIN_TEST
//         Url:            http://54.178.241.129:3000
//         Address:        SD2JQODO2F73GAU3BRUQDE3ENVA7Y4TJ2OL4KYB7
//         PublicKey:      0B14B288D888E424634BE76E9BADF618673C7639471F0BC6920BCD0CF35EB42D
//         PrivateKey:     1A245D98922DAEFC0B1F6B93AA22B88ABBF9461C39BFB43F1D04356081920348

export const nemElectoralCommission = {
  getElectoralCommissionPrivateKey() {
    return '54B494F5BBCE235D753E609EC460C69947495280D8DE381579E3F15BE4CF81CA';
  },

  validateTransaction(transaction: Transaction) {
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(this.getElectoralCommissionPrivateKey());
    return transaction.signer.equals(electoralCommissionAccount.publicAccount);
  }
}