import {
  MosaicId, Transaction,
} from 'nem2-sdk';
import { nemAccountService } from '../services/nem.account.service';

// Profile stored correctly
// default->
//         Network:        MIJIN_TEST
//         Url:            http://localhost:3000
//         Address:        SDRWZAGTTJ4KME6BAXZC7Y5SLWDX756OO7L35QG6
//         PublicKey:      431939E208AC28F6247CE32706E0A596A63FD5575E30856CD9A2E9F9A5B70127
//         PrivateKey:     AF39A544520AEAF74EE11C86034CC10F1BF8985688D03875D8EF070ED980913F

export const nemElectoralCommission = {
  getElectoralCommissionPrivateKey() {
    return 'AF39A544520AEAF74EE11C86034CC10F1BF8985688D03875D8EF070ED980913F';
  },

  validateTransaction(transaction: Transaction) {
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(this.getElectoralCommissionPrivateKey());    
    return transaction.signer.equals(electoralCommissionAccount.publicAccount);
  }
}