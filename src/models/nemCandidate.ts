import {
  Address,
  Mosaic,
  PublicAccount,
  AggregateTransaction,
  TransferTransaction,
  Deadline,
  MosaicId
} from 'nem2-sdk';

// Services
import { nemTransactionService } from "../services/nem.transaction.service";

// Constans
import { CodeTypes } from "../constants/codeType";
import { nemElectoralCommission } from './nemElectoralCommission';
import { nemBlockService } from '../services/block.service';

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

  countVotes(candidatePublicAccount: PublicAccount, electoralEventDate: any, mosaicIdVote: MosaicId) {
    return nemTransactionService.searchTransactions(candidatePublicAccount, AggregateTransaction,
      async (voteTransaction: AggregateTransaction): Promise<any> => {
        let electoralCommissionValidateTransaction = false;
        let candidateValidateTransaction = false;

        for (const transaction of voteTransaction.innerTransactions) {
          if (electoralCommissionValidateTransaction && candidateValidateTransaction) {
            break;
          }

          if (transaction instanceof TransferTransaction) {

            if (!electoralCommissionValidateTransaction) {
              if (nemElectoralCommission.validateTransaction(transaction)) {
                const payload = JSON.parse(transaction.message.payload);
                if (payload.code === CodeTypes.Vote) {
                  electoralCommissionValidateTransaction = true;
                }
              }
            }

            if (!candidateValidateTransaction) {
              if (transaction.recipient.equals(candidatePublicAccount.address)) {
                const mosaicValid = transaction.mosaics.find(mosaic => mosaic.id.equals(mosaicIdVote));
                if (mosaicValid) {
                  candidateValidateTransaction = true;
                }
              }
            }

          }
        }
        if (electoralCommissionValidateTransaction && candidateValidateTransaction) {
          const blockVoteTransaction = await nemBlockService.getBlockByHeight(voteTransaction.transactionInfo.height.compact());
          const voteTransactionDate = blockVoteTransaction.timestamp.compact() + (Deadline.timestampNemesisBlock * 1000);
          if (voteTransactionDate >= electoralEventDate.start) {
            if (electoralEventDate.end) {
              if (voteTransactionDate <= electoralEventDate.end) {
                return 'vote';
              }
            }
            else {
              return 'vote';
            }
          }
        }
      });
  }
}