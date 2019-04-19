import {
  Mosaic,
  UInt64,
  PublicAccount,
  TransferTransaction,
  AggregateTransaction,
  Transaction,
  Address,
  AccountHttp,
  Deadline,
  BlockInfo,
  BlockchainHttp,
  MosaicId,
} from 'nem2-sdk';

import { sha3_256 } from 'js-sha3';

import * as moment from 'moment'

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
import { LocalDateTime } from 'js-joda';
import { nemBlockService } from '../services/block.service';

export const nemElection = {

  create(electionData: Election, electoralEventPublicKey: string) {
    const validData = this.validData(electionData, electoralEventPublicKey)
    if (!validData.valid)
      return { created: false, data: validData.data }

    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);

    const electionId = this.generateElectionId(`
      ${electoralEventPublicKey}
      ${electionData.type}
      ${electionData.facultyId}
      ${electionData.schoolId}
    `);

    const existElectoralEventPromise = nemElectoralEvent.exist(electoralEventPublicAccount);
    const existMosaicVotePromise = nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);
    const existElectionPromise = this.exist(electoralEventPublicAccount, electionId);

    return Promise.all([existElectoralEventPromise, existMosaicVotePromise, existElectionPromise])
      .then(async ([existElectoralEvent, existMosaicVote, existElection]) => {
        try {
          if (!existElectoralEvent)
            return { created: false, data: [{ "election": "electoral event doesn't exist" }] }

          if (existElection)
            return { created: false, data: [{ "election": "election already exists" }] }

          if (existMosaicVote)
            return { created: false, data: [{ "election": "electoral event already start" }] }

          const electoralEventAddress = electoralEventPublicAccount.address;

          let message = JSON.stringify({
            code: CodeTypes.CreateElection,
            data: {
              id: electionId,
              name: electionData.name,
              type: electionData.type,
              levelElection: electionData.levelElection,
              typeCandidate: electionData.typeCandidate,//lista,uninominal
              typeElector: electionData.typeElector,
              facultyId: electionData.facultyId,
              schoolId: electionData.schoolId,
              allowedVotes: electionData.allowedVotes,
              period: electionData.period,
            }
          });

          const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
          const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

          const electoralEventCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], message).toAggregate(electoralCommissionAccount.publicAccount);

          let registerCandidatesTransactions = nemCandidate.registerCandidatesTransactions(electionData.candidates, electoralEventAddress, [], electoralCommissionAccount.publicAccount);

          const innerTransactions = [...registerCandidatesTransactions, electoralEventCreateTransferTransaction]
          const electoralEventCreateAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactions, []);
          const electoralEventCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralEventCreateAggregateTransaction);
          await nemTransactionService.announceTransaction(electoralEventCreateSignedTransaction);
          await nemTransactionService.awaitTransactionConfirmed(electoralEventAddress, electoralEventCreateSignedTransaction)

          const response = { created: true, data: [{ "election": "electoral event successfully created" }] };

          return response;
        }
        catch (error) {
          throw (error);
        }
      })

      .catch(reason => {
        throw new Error(reason);
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

    if (!election.hasOwnProperty('candidates')) {
      valid = false;
      errors.push({ candidates: "candidates is required" });
    }
    else if (election.candidates.length === 0) {
      valid = false;
      errors.push({ candidates: "candidates can not be empty" });
    }

    let errorsCandidates = [];
    for (let i = 0; i < election.candidates.length; i++) {
      const candidate = election.candidates[i];
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

  generateElectionId(message: string) {
    return sha3_256(message.toLowerCase()).toUpperCase();
  },

  exist(electoralEventPublicAccount: PublicAccount, electionId: string) {
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, AggregateTransaction,
      (transactionElectionCreate: any): any => {
        for (const innerTransaction of transactionElectionCreate.innerTransactions) {
          const payload = JSON.parse(innerTransaction.message.payload);
          if (payload.code === CodeTypes.CreateElection) {
            if (payload.data.id === electionId) {
              if (nemElectoralCommission.validateTransaction(innerTransaction)) {
                return true;
              }
            }
          }
        }
        return false;
      });
  },

  getAll(electoralEventPublicKey: string, electionsIds?: any[]) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    return nemTransactionService.searchTransactions(electoralEventPublicAccount, AggregateTransaction,
      (transactionElectionCreate: any): any => {
        for (const innerTransaction of transactionElectionCreate.innerTransactions) {
          if (innerTransaction instanceof TransferTransaction) {
            const payload = JSON.parse(innerTransaction.message.payload);
            if (payload.code === CodeTypes.CreateElection) {
              if (nemElectoralCommission.validateTransaction(innerTransaction)) {
                if (electionsIds) {
                  if (electionsIds.find(id => id === payload.data.id)) {
                    const candidates = nemCandidate.getCandidates(transactionElectionCreate);
                    let election = payload.data;
                    election['candidates'] = candidates;
                    return election;
                  }
                }
                else {
                  const candidates = nemCandidate.getCandidates(transactionElectionCreate);
                  let election = payload.data;
                  election['candidates'] = candidates;
                  return election;
                }
              }
            }
          }
        }
      });
  },

  async result(electoralEventPublicKey: string, election: any) {
    let candidates = [...election.candidates];

    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);

    const getMosaicVoteTransactionPromise = nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);
    const finalizedElectionTransactionPromise = nemElectoralEvent.finished(electoralEventPublicAccount);

    try {
      const [mosaicVoteTransaction, finalizedElectionTransaction] = await Promise.all([getMosaicVoteTransactionPromise, finalizedElectionTransactionPromise])

      let electoralEventDate = {
        start: undefined,
        end: undefined,
      };

      const blockMosaicVoteTransaction = await nemBlockService.getBlockByHeight(mosaicVoteTransaction.transactionInfo.height.compact());
      electoralEventDate.start = blockMosaicVoteTransaction.timestamp.compact() + (Deadline.timestampNemesisBlock * 1000);

      if (finalizedElectionTransaction) {
        const blockFinalizedElectionTransaction = await nemBlockService.getBlockByHeight(finalizedElectionTransaction.transactionInfo.height.compact());
        electoralEventDate.end = blockFinalizedElectionTransaction.timestamp.compact() + (Deadline.timestampNemesisBlock * 1000);
      }

      const mosaicIdHex = JSON.parse(mosaicVoteTransaction.message.payload).data.mosaicIdHex;
      const mosaicIdVote = new MosaicId(mosaicIdHex);
      let votesPromise = [];
      for (const candidate of candidates) {
        const candidatePublicAccount = nemAccountService.getDeterministicPublicAccount(`${election.id}${candidate.identityDocument}`);
        const votePromise = nemCandidate.countVotes(candidatePublicAccount, electoralEventDate, mosaicIdVote);
        votesPromise.push(votePromise);
      }
      let votesElection = await Promise.all(votesPromise);
      for (let i = 0; i < candidates.length; i++) {
        let votesCandidate = await Promise.all(votesElection[i]);
        let votes = votesCandidate.filter(_ => _ !== undefined);
        candidates[i]['votes'] = votes.length;
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