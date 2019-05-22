import {
  Address,
  Mosaic,
  PublicAccount,
  AggregateTransaction,
  TransferTransaction,
  Deadline,
  MosaicId,
  PlainMessage
} from 'nem2-sdk';

// Services
import { nemTransactionService } from "../services/nem.transaction.service";

// Constans
import { CodeTypes } from "../constants/codeType";
import { nemElectoralCommission } from './nemElectoralCommission';
import { nemBlockService } from '../services/block.service';
// interfaces

import { Candidate } from "../interfaces/Candidate";
import { nemElectoralRegister } from './nemElectoralRegister';
import { nemAccountService } from '../services/nem.account.service';

export const nemCandidate = {
  async registerCandidatesTransactions(typeElector: string, candidates: Candidate[], recipent: Address, signer: PublicAccount, electoralEventPublickey: any) {
    const electoralRegisterPublicAccount = nemAccountService.getDeterministicPublicAccount(`${electoralEventPublickey} - Registro Electoral`.toLowerCase());

    const electoralRegisterPublickey = electoralRegisterPublicAccount.publicKey

    const registerCandidatesTransactions = [];
    const validCandidatesPromise = [];

    for (const candidate of candidates) {
      validCandidatesPromise.push(nemElectoralRegister.validateElector(electoralRegisterPublickey, candidate.identityDocument, typeElector));
      let message = JSON.stringify({
        code: CodeTypes.RegisterCandidate,
        data: candidate
      });
      const registerCandidateTransaction = nemTransactionService.transferTransaction(recipent, [], PlainMessage.create(message)).toAggregate(signer);
      registerCandidatesTransactions.push(registerCandidateTransaction);
    }
    const validCandidates = await Promise.all(validCandidatesPromise);
    for (let i = 0; i < validCandidates.length; i++) {
      const validCandidate = validCandidates[i];
      for (let j = 0; j < candidates.length; j++) {
        const candidate = candidates[j];
        if (candidate.identityDocument === validCandidate.identityDocument) {
          candidates.splice(j, 1);
        }
      }
    }

    const notValidCandidates = [...candidates];
    if (notValidCandidates.length > 0)
      return { valid: false, data: notValidCandidates };

    return { valid: true, data: registerCandidatesTransactions };
  },

  searchCandidates(transactionElectionCreate: AggregateTransaction) {
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

  getCandidates(electoralEventPublicKey: string, electionId: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, AggregateTransaction,
      (transactionCandidatesCreate: any): any => {
        for (const innerTransaction of transactionCandidatesCreate.innerTransactions) {
          if (innerTransaction instanceof TransferTransaction) {
            const payload = JSON.parse(innerTransaction.message.payload);
            if (payload.code === CodeTypes.RegisterCandidates) {
              if (nemElectoralCommission.validateTransaction(innerTransaction)) {
                if (payload.data.electionId === electionId) {
                  const candidates = this.searchCandidates(transactionCandidatesCreate);
                  return candidates;
                }
              }
            }
          }
        }
      });
  },

  validData(candidates: Candidate[], electoralEventPublicKey: string) {

    let valid: boolean = true;
    let errors: any[] = [];

    if (electoralEventPublicKey === "" || electoralEventPublicKey === undefined || electoralEventPublicKey === null) {
      valid = false;
      errors.push({ electoralEventPublicKey: "electoralEventPublicKey can not be empty" });
    }

    if (candidates.length === 0) {
      valid = false;
      errors.push({ candidates: "candidates is required" });
    }

    let errorsCandidates = [];
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate.hasOwnProperty('identityDocument')) {
        valid = false;
        errorsCandidates.push({ identityDocument: `candidate ${i + 1} identity document is required` });
      }
      else if (candidate.identityDocument === "") {
        valid = false;
        errorsCandidates.push({ identityDocument: `candidate ${i + 1} identity document can not be empty` });
      }

      if (candidate.hasOwnProperty('list')) {
        if (candidate.list === "") {
          valid = false;
          errorsCandidates.push({ list: `candidate ${i + 1} list can not be empty` });
        }
      }

      if (!candidate.hasOwnProperty('name')) {
        valid = false;
        errorsCandidates.push({ name: `candidate ${i + 1} name is required` });
      }
      else if (candidate.name === "") {
        valid = false;
        errorsCandidates.push({ name: `candidate ${i + 1} name can not be empty` });
      }

      if (!candidate.hasOwnProperty('position')) {
        valid = false;
        errorsCandidates.push({ position: `candidate ${i + 1} position is required` });
      }
      else if (candidate.position === "") {
        valid = false;
        errorsCandidates.push({ position: `candidate ${i + 1} position can not be empty` });
      }
    }
    if (errorsCandidates.length > 0) {
      errors.push({ candidates: errorsCandidates });
    }

    return { valid, data: errors };
  },

  countVotes(candidatePublicAccount: PublicAccount) {
    return nemTransactionService.searchTransaction(candidatePublicAccount, AggregateTransaction,
      (voteTransaction: AggregateTransaction): any => {
        let electoralCommissionValidateTransaction = false;
        let candidateValidateTransaction = false;
        let votes = 0;
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
                const payload = JSON.parse(transaction.message.payload);
                if (payload.code === CodeTypes.Vote) {
                  console.log('transaction :', transaction);
                  votes = payload.data.votes
                  candidateValidateTransaction = true;
                }
              }
            }
          }
        }
        if (electoralCommissionValidateTransaction && candidateValidateTransaction) {
          return votes;
        }
        else {
          return 0
        }
      });
  }
}