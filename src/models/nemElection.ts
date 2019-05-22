import {
  MosaicId,
  Deadline,
  PublicAccount,
  TransferTransaction,
  AggregateTransaction,
  PlainMessage,
  EncryptedMessage,
} from 'nem2-sdk';

import moment from 'moment'
import { sha3_256 } from 'js-sha3';

// models
import { nemCandidate } from "../models/nemCandidate";
import { nemElectoralEvent } from "../models/nemElectoralEvent";
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";

// interfaces
import { Election } from "../interfaces/Election";

// Constans
import { CodeTypes } from "../constants/codeType";
import { LevelElectionEnum } from "../constants/levelElection";
import { nemBlockService } from '../services/block.service';
import { Candidate } from '../interfaces/Candidate';
import { nemElectoralRegister } from './nemElectoralRegister';

export const nemElection = {

  create(electionData: Election, electoralEventPublicKey: string) {
    const validData = this.validData(electionData, electoralEventPublicKey)
    if (!validData.valid)
      return { created: false, data: validData.data }

    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);

    if (!electionData.facultyId)
      electionData.facultyId = '00';

    if (!electionData.schoolId)
      electionData.schoolId = '00';

    const electionId = this.generateElectionId(`
      ${electoralEventPublicKey}
      ${electionData.type}
      ${electionData.facultyId}
      ${electionData.schoolId}
    `);

    const existElectoralEventPromise = nemElectoralEvent.exist(electoralEventPublicAccount);
    const existElectionPromise = this.exist(electoralEventPublicAccount, electionId);

    return Promise.all([existElectoralEventPromise, existElectionPromise])
      .then(async ([transactionElectoralEvent, existElection]) => {
        try {
          if (!transactionElectoralEvent)
            return { created: false, data: [{ "election": "evento electoral no existe" }] }

          const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data;

          const dateFormat: string = "DD-MM-YYYY H:mm";
          const today = moment();

          const startDateCreateElection = moment(electoralEvent.startDateCreateElection, dateFormat);
          const endDateCreateElection = moment(electoralEvent.endDateCreateElection, dateFormat);

          if (startDateCreateElection.isAfter(today))
            return { created: false, data: [{ "election": "no ha iniciado el proceso de creación de elección" }] }

          if (endDateCreateElection.isBefore(today))
            return { created: false, data: [{ "election": "ya finalizó el proceso de creación de elección" }] }

          if (existElection)
            return { created: false, data: [{ "election": "ya existe la elección" }] }

          let message = JSON.stringify({
            code: CodeTypes.CreateElection,
            data: {
              id: electionId,
              name: electionData.name,
              type: electionData.type,
              levelElection: electionData.levelElection,
              typeCandidate: electionData.typeCandidate,
              typeElector: electionData.typeElector,
              facultyId: electionData.facultyId,
              schoolId: electionData.schoolId,
              allowedVotes: electionData.allowedVotes,
              period: electionData.period,
            }
          });

          const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
          const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
          const electoralEventAddress = electoralEventPublicAccount.address;

          const electionCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], PlainMessage.create(message));
          const electionCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electionCreateTransferTransaction);
          await nemTransactionService.announceTransactionAsync(electoralEventAddress, electionCreateSignedTransaction);

          const response = { created: true, data: [{ "election": "creación de elección éxitosa" }] };

          return response;
        }
        catch (error) {
          throw (error);
        }
      })

      .catch(reason => {
        throw reason;
      })
  },

  associateCandidates(election: Election, candidates: Candidate[], electoralEventPublicKey: string) {
    const validData = nemCandidate.validData(candidates, electoralEventPublicKey);
    if (!validData.valid)
      return { created: false, data: validData.data }

    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);

    const existElectoralEventPromise = nemElectoralEvent.exist(electoralEventPublicAccount);
    const existElectoralRegisterPromise = nemElectoralRegister.exist(electoralEventPublicKey);
    const existElectionPromise = this.exist(electoralEventPublicAccount, election.id);
    const existCandidatePromise = nemCandidate.getCandidates(electoralEventPublicKey, election.id);

    return Promise.all([existElectoralEventPromise, existElectoralRegisterPromise, existElectionPromise, existCandidatePromise])
      .then(async ([transactionElectoralEvent, electoralRegisterTransaction, existElection, existCandidate]) => {
        try {
          if (!transactionElectoralEvent)
            return { created: false, data: [{ "election": "evento electoral no existe" }] }

          const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data;

          const dateFormat: string = "DD-MM-YYYY H:mm";
          const today = moment();

          const startDateRegisterCandidate = moment(electoralEvent.startDateRegisterCandidate, dateFormat);
          const endDateRegisterCandidate = moment(electoralEvent.endDateRegisterCandidate, dateFormat);

          // if (startDateRegisterCandidate.isAfter(today))
          //   return { created: false, data: [{ "election": "no ha iniciado el proceso de registro de candidatos" }] }

          // if (endDateRegisterCandidate.isBefore(today))
          //   return { created: false, data: [{ "election": "ya finalizó el proceso de de registro de candidatos" }] }

          if (!electoralRegisterTransaction)
            return { created: false, data: [{ "election": "no existe registro electoral" }] }

          if (!existElection)
            return { created: false, data: [{ "election": "no existe la elección" }] }

          if (existCandidate.length > 0)
            return { created: false, data: [{ "election": "ya existe candidatos" }] }

          const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
          const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
          const electoralEventAddress = electoralEventPublicAccount.address;

          let message = JSON.stringify({
            code: CodeTypes.RegisterCandidates,
            data: {
              electionId: election.id
            }
          });

          const electionCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], PlainMessage.create(message)).toAggregate(electoralCommissionAccount.publicAccount);

          let registerCandidatesTransactions = await nemCandidate.registerCandidatesTransactions(election.typeElector, candidates, electoralEventAddress, electoralCommissionAccount.publicAccount, electoralEventPublicKey);
          if (!registerCandidatesTransactions.valid) {
            return { created: false, data: registerCandidatesTransactions.data };
          }

          const innerTransactions = [...registerCandidatesTransactions.data, electionCreateTransferTransaction]
          const electoralEventCreateAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactions, []);
          const electoralEventCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralEventCreateAggregateTransaction);
          await nemTransactionService.announceTransactionAsync(electoralEventAddress, electoralEventCreateSignedTransaction)

          return { created: true, data: "registro de candidatos exitoso" };
        }
        catch (error) {
          throw (error);
        }
      })

      .catch(reason => {
        throw reason;
      })
  },

  validData(election: Election, electoralEventPublicKey: string) {
    let valid: boolean = true;
    let errors: any[] = [];

    if (electoralEventPublicKey === "" || electoralEventPublicKey === undefined || electoralEventPublicKey === null) {
      valid = false;
      errors.push({ electoralEventPublicKey: "electoralEventPublicKey can not be empty" });
    }

    if (!election.hasOwnProperty('name')) {
      valid = false;
      errors.push({ name: "name is required" });
    }
    else if (election.name === "") {
      valid = false;
      errors.push({ name: "name can not be empty" });
    }

    if (!election.hasOwnProperty('allowedVotes')) {
      valid = false;
      errors.push({ allowedVotes: "allowed votes is required" });
    }
    else if (election.allowedVotes === "") {
      valid = false;
      errors.push({ allowedVotes: "allowed votes can not be empty" });
    }
    else if (isNaN(Number(election.allowedVotes))) {
      valid = false;
      errors.push({ allowedVotes: "allowed votes must be a number" });
    }

    if (!election.hasOwnProperty('levelElection')) {
      valid = false;
      errors.push({ levelElection: "level election is required" });
    }
    else if (election.levelElection === "") {
      valid = false;
      errors.push({ levelElection: "level election can not be empty" });

      if (election.levelElection === LevelElectionEnum.faculty) {
        if (!election.hasOwnProperty('facultyId')) {
          valid = false;
          errors.push({ facultyId: "faculty id is required" });
        }
        else if (election.facultyId === "") {
          valid = false;
          errors.push({ facultyId: "faculty id can not be empty" });
        }
      }

      if (election.levelElection === LevelElectionEnum.school) {

        if (!election.hasOwnProperty('facultyId')) {
          valid = false;
          errors.push({ facultyId: "faculty id is required" });
        }
        else if (election.facultyId === "") {
          valid = false;
          errors.push({ facultyId: "faculty id can not be empty" });
        }

        if (!election.hasOwnProperty('schoolId')) {
          valid = false;
          errors.push({ schoolId: "school id is required" });
        }
        else if (election.schoolId === "") {
          valid = false;
          errors.push({ schoolId: "school id can not be empty" });
        }
      }
    }

    if (!election.hasOwnProperty('period')) {
      valid = false;
      errors.push({ period: "period is required" });
    }
    else if (election.period === "") {
      valid = false;
      errors.push({ period: "period can not be empty" });
    }

    if (!election.hasOwnProperty('type')) {
      valid = false;
      errors.push({ type: "type is required" });
    }
    else if (election.type === "") {
      valid = false;
      errors.push({ type: "type can not be empty" });
    }

    if (!election.hasOwnProperty('typeCandidate')) {
      valid = false;
      errors.push({ typeCandidate: "type candidate is required" });
    }
    else if (election.typeCandidate === "") {
      valid = false;
      errors.push({ typeCandidate: "type candidate can not be empty" });
    }

    if (!election.hasOwnProperty('typeElector')) {
      valid = false;
      errors.push({ typeElector: "type elector is required" });
    }
    else if (election.typeElector === "") {
      valid = false;
      errors.push({ typeElector: "type elector can not be empty" });
    }

    return { valid, data: errors };

  },

  generateElectionId(message: string) {
    return sha3_256(message.toLowerCase()).toUpperCase();
  },

  exist(electoralEventPublicAccount: PublicAccount, electionId: string) {
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction,
      (transactionElectionCreate: any): any => {
        const payload = JSON.parse(transactionElectionCreate.message.payload);
        if (payload.code === CodeTypes.CreateElection) {
          if (payload.data.id === electionId) {
            if (nemElectoralCommission.validateTransaction(transactionElectionCreate)) {
              return true;
            }
          }
        }
        return false;
      });
  },


  getTransactions(electoralEventPublicKey: string, electionsIds?: any[]) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    return nemTransactionService.searchTransactions(electoralEventPublicAccount, TransferTransaction,
      (electionCreateTransaction: TransferTransaction): any => {
        const payload = JSON.parse(electionCreateTransaction.message.payload);
        if (payload.code === CodeTypes.CreateElection) {
          if (nemElectoralCommission.validateTransaction(electionCreateTransaction)) {
            if (electionsIds) {
              if (electionsIds.find(id => id === payload.data.id)) {
                // const candidates = await nemCandidate.getCandidates(electoralEventPublicKey, payload.data.id);
                return nemCandidate.getCandidates(electoralEventPublicKey, payload.data.id)
                  .then(candidates => {
                    let election = payload.data;
                    election['candidates'] = candidates;
                    return election;
                  })
              }
            }
            else {
              // const candidates = await nemCandidate.getCandidates(electoralEventPublicKey, payload.data.id);
              return nemCandidate.getCandidates(electoralEventPublicKey, payload.data.id)
                .then(candidates => {
                  let election = payload.data;
                  election['candidates'] = candidates;
                  return election;
                })
            }
          }
        }
      });
  },

  async getAll(electoralEventPublicKey: string, electionsIds?: any[]) {
    let elections = await nemElection.getTransactions(electoralEventPublicKey, electionsIds);
    return Promise.all(elections);
  },

  getVotes(electionVotePublicAccount: PublicAccount, electionId: string, electoralEventDate: any) {
    return nemTransactionService.searchTransactions(electionVotePublicAccount, AggregateTransaction,
      async (electionVoteTransaction: AggregateTransaction): Promise<any> => {
        const innerTransactions = electionVoteTransaction.innerTransactions;
        let electoralCommissionValidateTransaction = false;
        let votes = [];
        const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey();
        for (const innerTransaction of innerTransactions) {
          if (innerTransaction instanceof TransferTransaction) {
            if (nemElectoralCommission.validateTransaction(innerTransaction)) {
              const payload = JSON.parse(innerTransaction.message.payload);
              if (payload.code === CodeTypes.Vote) {
                electoralCommissionValidateTransaction = true;
              }
            }
            else {
              try {
                const vote = JSON.parse(EncryptedMessage.decrypt(innerTransaction.message, electoralCommissionPrivateKey, electionVotePublicAccount).payload);
                if (vote.electionId === electionId) {
                  votes.push(vote);
                }
              }
              catch (error) {
                continue;
              }
            }
          }
        }
        const blockVoteTransaction = await nemBlockService.getBlockByHeight(electionVoteTransaction.transactionInfo.height.compact());
        const voteTransactionDate = blockVoteTransaction.timestamp.compact() + (Deadline.timestampNemesisBlock * 1000);

        if (electoralCommissionValidateTransaction && voteTransactionDate >= electoralEventDate.start && voteTransactionDate <= electoralEventDate.end) {
          votes = [].concat.apply([], votes)
          return votes;
        }
      });
  },

  async result(electoralEventPublicKey: string, election: any) {
    let candidates = [...election.candidates];
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);

    try {
      const isTotalizeElectionTransaction = await nemElectoralEvent.isTotalize(electoralEventPublicAccount);

      if (!isTotalizeElectionTransaction) {
        return { totalize: false, data: "Evento electoral no ha sido totalizado" }
      }

      let votesPromise = [];
      for (const candidate of candidates) {
        const candidatePublicAccount = nemAccountService.getDeterministicPublicAccount(`${election.id}${candidate.identityDocument}`);
        console.log('candidatePublicAccount', candidatePublicAccount)
        const votePromise = nemCandidate.countVotes(candidatePublicAccount);
        votesPromise.push(votePromise);
      }
      let votesElection = await Promise.all(votesPromise);
      for (let i = 0; i < candidates.length; i++) {
        candidates[i]['votes'] = votesElection[i] ? votesElection[i] : 0;
      }

      candidates.sort((a, b) => {
        if (a.votes > b.votes) return -1;
        if (a.votes < b.votes) return 1;
        return 0;
      });

      election.candidates = candidates;

      return election;
    }

    catch (error) {
      throw (error)
    }
  }
}