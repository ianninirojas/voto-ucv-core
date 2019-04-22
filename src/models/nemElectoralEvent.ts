import {
  Mosaic,
  UInt64,
  Address,
  PublicAccount,
  MosaicProperties,
  MosaicSupplyType,
  TransferTransaction,
  AggregateTransaction,
} from 'nem2-sdk';

import moment from 'moment'

// models
import { nemElection } from "../models/nemElection";
import { nemElectoralRegister } from "../models/nemElectoralRegister";
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { nemMosaicService } from '../services/nem.mosaic.service';
import { nemAccountService } from '../services/nem.account.service';
import { nemTransactionService } from '../services/nem.transaction.service';

// interfaces

import { ElectoralEvent } from "../interfaces/ElectoralEvent";

// constans
import { CodeTypes } from "../constants/codeType";

export const nemElectoralEvent = {

  getMosaicVote(electoralEventPublicAccount: any) {
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, AggregateTransaction,
      (transactionMosaicVoteCreate: any): any => {
        for (const innerTransaction of transactionMosaicVoteCreate.innerTransactions) {
          if (innerTransaction instanceof TransferTransaction) {
            const payload = JSON.parse(innerTransaction.message.payload);
            if (payload.code === CodeTypes.CreateMosaicVote) {
              if (nemElectoralCommission.validateTransaction(innerTransaction)) {
                return innerTransaction;
              }
            }
          }
        }
        return false;
      });
  },

  async createMosaicToVote(eventElectoralAddress: Address) {
    try {
      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

      const mosaicProperties = MosaicProperties.create({
        supplyMutable: true,
        transferable: true,
        levyMutable: false,
        divisibility: 0,
      });

      const mosaicDefinitionTransaction = nemMosaicService.mosaicDefinitionTransaction(electoralCommissionAccount, mosaicProperties);

      const mosaicSupplyChangeTransaction = nemMosaicService.mosaicSupplyChangeTransaction(mosaicDefinitionTransaction.mosaicId, MosaicSupplyType.Increase, UInt64.fromUint(1))


      let message = JSON.stringify({
        code: CodeTypes.CreateMosaicVote,
        data: {
          mosaicIdHex: mosaicDefinitionTransaction.mosaicId.toHex()
        }
      })

      const saveMosaicIdTransferTransaction = nemTransactionService.transferTransaction(eventElectoralAddress, [], message);

      const innerTransactions = [
        mosaicDefinitionTransaction.toAggregate(electoralCommissionAccount.publicAccount),
        mosaicSupplyChangeTransaction.toAggregate(electoralCommissionAccount.publicAccount),
        saveMosaicIdTransferTransaction.toAggregate(electoralCommissionAccount.publicAccount)
      ];

      const createMosaicToVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactions, []);
      const createMosaicToVoteSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, createMosaicToVoteAggregateTransaction);

      await nemTransactionService.announceTransactionAsync(eventElectoralAddress, createMosaicToVoteSignedTransaction)
    }
    catch (error) {
      throw (error)
    }
  },

  finished(electoralEventPublicAccount: any) {
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction,
      (transactionElectoralEvent: TransferTransaction): any => {
        const payload = JSON.parse(transactionElectoralEvent.message.payload);
        if (payload.code === CodeTypes.FinishElectoralEvent) {
          if (nemElectoralCommission.validateTransaction(transactionElectoralEvent)) {
            return transactionElectoralEvent;
          }
        }

        return false
      });
  },

  async finish(electoralEventPublicKey: string) {
    try {
      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
      const transactionElectoralEvent = await this.exist(electoralEventPublicAccount);
      if (!transactionElectoralEvent)
        return { finished: false, data: [{ electoralEvent: "evento electoral no existe" }] }

      const getMosaicVoteResponse = await this.getMosaicVote(electoralEventPublicAccount);
      if (!getMosaicVoteResponse)
        return { activated: false, data: [{ electoralEvent: "evento electoral no está activo" }] }

      const finished = await this.finished(electoralEventPublicAccount);

      if (!finished)
        return { finished: false, data: [{ electoralEvent: "evento electoral ya ha finalizado" }] }


      let message = JSON.stringify({
        code: CodeTypes.FinishElectoralEvent,
      });

      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

      const electoralEventAddress = electoralEventPublicAccount.address;


      const electoralEventFinishTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], message);
      const electoralEventFinishSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralEventFinishTransferTransaction);

      await nemTransactionService.announceTransactionAsync(electoralEventAddress, electoralEventFinishSignedTransaction);
      return { finished: true, data: "electoral event finished" }

    } catch (error) {
      throw (error)
    }
  },

  async activate(electoralEventPublicKey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    try {
      const transactionElectoralEvent = await this.exist(electoralEventPublicAccount);
      if (!transactionElectoralEvent)
        return { activated: false, data: [{ electoralEvent: "evento electoral no existe" }] }

      const getMosaicVoteResponse = await this.getMosaicVote(electoralEventPublicAccount);
      if (getMosaicVoteResponse)
        return { activated: false, data: [{ electoralEvent: "evento electoral ya está activo" }] }

      const elections = await nemElection.getAll(electoralEventPublicKey);
      if (elections.length === 0)
        return { activated: false, data: [{ electoralEvent: "evento electoral no tiene elecciones asociadas" }] }

      const electoralRegister = await nemElectoralRegister.exist(electoralEventPublicKey);
      if (electoralRegister)
        return { activated: false, data: [{ electoralEvent: "evento electoral no tiene registro electoral asociado" }] }

      const electoralEventAddress = electoralEventPublicAccount.address;

      await this.createMosaicToVote(electoralEventAddress);
      return { activated: true, data: "electoral event activate" }
    }
    catch (error) {
      return { activated: false, data: error }
    }
  },

  async isItTimeToVote(electoralEventPublicKey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    let getMosaicVotePromise = this.getMosaicVote(electoralEventPublicAccount);
    let finalizedElectionPromise = this.finished(electoralEventPublicAccount);
    return Promise.all([getMosaicVotePromise, finalizedElectionPromise])
      .then(([getMosaicVote, finalizedElection]) => {
        return !finalizedElection && getMosaicVote;
      })
      .catch(reason => {
        return reason;
      });
  },

  async getByHash(hash: string) {
    const electoralEventTransaction = await nemTransactionService.getTransaction(hash);
    if (electoralEventTransaction instanceof TransferTransaction) {
      if (nemElectoralCommission.validateTransaction(electoralEventTransaction)) {
        const payload = JSON.parse(electoralEventTransaction.message.payload);
        return payload;
      }
    }
    return null;
  },

  async getByName(electoralEventName: string) {
    const electoralEventPublicAccount = nemAccountService.getDeterministicPublicAccount(electoralEventName.toLowerCase());
    try {
      const electoralEventTransaction = await this.exist(electoralEventPublicAccount);
      if (!nemElectoralCommission.validateTransaction(electoralEventTransaction))
        throw new Error('no validate');

      if (electoralEventTransaction instanceof TransferTransaction) {
        const response = { data: { electoralEventHashTransaction: electoralEventTransaction.transactionInfo.hash } };
        return response;
      }

    } catch (error) {
      throw new Error(error);
    }
  },

  async getAll(electoralEventsHash: any[]) {
    const electoralEvents = [];
    for (const electoralEventHash of electoralEventsHash) {
      const electoralEvent = await this.getByHash(electoralEventHash.hash);
      if (electoralEvent)
        electoralEvents.push(electoralEvent);
    }
    return electoralEvents;
  },

  exist(electoralEventPublicAccount: PublicAccount) {
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction,
      (transactionElectoralEvent: TransferTransaction): any => {
        const payload = JSON.parse(transactionElectoralEvent.message.payload);
        if (payload.code === CodeTypes.CreateElectoralEvent) {
          if (nemElectoralCommission.validateTransaction(transactionElectoralEvent)) {
            return transactionElectoralEvent;
          }
        }
        return false;
      });
  },

  validData(electoralEvent: ElectoralEvent) {
    let valid: boolean = true;
    let errors: any[] = [];
    const dateFormat: string = "DD/MM/YYYY HH:mm";

    if (!electoralEvent.hasOwnProperty("name")) {
      valid = false;
      errors.push({ name: "name is required" });
    }
    else if (electoralEvent.name === "") {
      valid = false;
      errors.push({ name: "name can not be empty" });
    }

    if (!electoralEvent.hasOwnProperty("startDate")) {
      valid = false;
      errors.push({ startDate: "start date is required" });
    }
    else if (electoralEvent.startDate === "") {
      valid = false;
      errors.push({ startDate: "start date can not be empty" });
    }
    else if (moment(electoralEvent.startDate, dateFormat).format(dateFormat) !== electoralEvent.startDate) {
      valid = false;
      errors.push({ startDate: `invalid format start date, must be ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("endDate")) {
      valid = false;
      errors.push({ endDate: "end date is required" });
    }
    else if (electoralEvent.endDate === "") {
      valid = false;
      errors.push({ endDate: "endDate can not be empty" });
    }
    else if (moment(electoralEvent.endDate, dateFormat).format(dateFormat) !== electoralEvent.endDate) {
      valid = false;
      errors.push({ endDate: `invalid format end date, must be ${dateFormat}` });
    }

    return { valid, data: errors };
  },

  validDate(startDate: string, endDate: string) {
    const dateFormat: string = "MM/DD/YYYY H:mm";
    const nowDate = moment();
    let valid: boolean = true;
    let errors: any[] = [];
    let startDateMoment = moment(startDate, dateFormat);
    let endDateMoment = moment(endDate, dateFormat);

    if (startDateMoment.isSameOrBefore(nowDate)) {
      valid = false;
      errors.push({ startDate: "the start date can not be before today" })
    }

    if (endDateMoment.isSameOrBefore(startDateMoment)) {
      valid = false;
      errors.push({ endDate: "the end date can not be before the start date" })
    }
    return { valid, data: errors }
  },

  async create(electoralEventData: any) {
    try {
      const validData = this.validData(electoralEventData)
      if (!validData.valid)
        return { created: false, data: validData.data }

      const validDate = this.validDate(electoralEventData.startDate, electoralEventData.endDate)
      if (!validDate.valid)
        return { created: false, data: validDate.data }

      const electoralEventPublicAccount = nemAccountService.getDeterministicPublicAccount(electoralEventData.name.toLowerCase());
      const existElectoralEventResponse = await this.exist(electoralEventPublicAccount);
      if (existElectoralEventResponse)
        return { created: false, data: [{ "electoralEvent": "electoral event already exists" }] }

      let message = JSON.stringify({
        code: CodeTypes.CreateElectoralEvent,
        data: {
          name: electoralEventData.name,
          startDate: electoralEventData.startDate,
          endDate: electoralEventData.endDate,
        }
      });

      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
      const electoralEventAddress = electoralEventPublicAccount.address;

      const electoralEventCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], message);
      const electoralEventCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralEventCreateTransferTransaction);
      await nemTransactionService.announceTransactionAsync(electoralEventAddress, electoralEventCreateSignedTransaction);

      const response = { created: true, data: { electoralEventHashTransaction: electoralEventCreateSignedTransaction.hash } };

      return response;
    }
    catch (error) {
      throw (error);
    }
  }
}