import {
  UInt64,
  Mosaic,
  Address,
  PublicAccount,
} from 'nem2-sdk';

//Models
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";

export const voter = {

  registerVoterTransaction(recipent: Address, voter: any, signer: PublicAccount) {
    const mosaicsToValidateTransaction = [new Mosaic(nemElectoralCommission.getOfficialMosaicId(), UInt64.fromUint(1))];
    return nemTransactionService.transferTransaction(recipent, mosaicsToValidateTransaction, JSON.stringify(voter)).toAggregate(signer);
  },

  async registerVoters(voters: any[], electoralEventData: any) {
    const electoralEventPublicAccount = nemAccountService.getDeterministicPublicAccount(electoralEventData.name.toLowerCase());
    const existElectoralEvent = await electoralEventData.existElectoralEvent(electoralEventPublicAccount);
    if(!existElectoralEvent){
      return "No existe evento electoral";
    }
    const registerCandidatesTransactions = [];
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

    const electoralRegisterPublicAccount = nemAccountService.getDeterministicPublicAccount(`electoral-register-${electoralEventPublicAccount.address.plain()}`);

    for (const voter of voters) {
      const registerCandidateTransaction = this.registerVoterTransaction(electoralRegisterPublicAccount.address, voter, electoralCommissionAccount.publicAccount)
      registerCandidatesTransactions.push(registerCandidateTransaction);
    }

    const registerVotersAggregateTransaction = nemTransactionService.aggregateTransaction(registerCandidatesTransactions, []);
    const registerVotersSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, registerVotersAggregateTransaction);
    const announceTransactionResponse = await nemTransactionService.announceTransaction(registerVotersSignedTransaction);

    if (announceTransactionResponse.message === 'ok') {
      const response = await nemTransactionService.awaitTransactionConfirmed(electoralRegisterPublicAccount.address, registerVotersSignedTransaction)
      if (response) {
        return "Se creo con registro electoral";
      }
      else {
        return 'hubo un problema';
      }
    }
  },

  getVoter() {

  }
}