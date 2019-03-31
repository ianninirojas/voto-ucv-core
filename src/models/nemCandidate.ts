import {
  Address,
  Mosaic,
  PublicAccount,
  AggregateTransaction,
  TransferTransaction
} from 'nem2-sdk';

// Services
import { nemTransactionService } from "../services/nem.transaction.service";

// Constans
import { CodeTypes } from "../constants/codeType";

export const nemCandidate = {
  registerCandidatesTransactions(candidates: any[], recipent: Address, mosaics: Mosaic[], signer: PublicAccount) {
    const registerCandidatesTransactions = [];
    for (const candidate of candidates) {
      let message = JSON.stringify({
        code: CodeTypes.RegisterCandidate,
        data: candidate
      });
      const registerCandidateTransaction = nemTransactionService.transferTransaction(recipent, mosaics, message).toAggregate(signer);
      registerCandidatesTransactions.push(registerCandidateTransaction);
    }
    return registerCandidatesTransactions;
  },

  getCandidates(transactionElectionCreate: AggregateTransaction) {
    const candidates = [];
    for (const innerTransaction of transactionElectionCreate.innerTransactions) {
      if (innerTransaction instanceof TransferTransaction) {
        const payload = JSON.parse(innerTransaction.message.payload);
        if (payload.code === CodeTypes.RegisterCandidate) {
          const candidate = payload.data;
          candidates.push(candidate);
        }
      }
    }
    return candidates;
  },
}