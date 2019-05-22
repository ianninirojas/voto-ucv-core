import {
  Mosaic,
  UInt64,
  Address,
  PublicAccount,
  MosaicProperties,
  MosaicSupplyType,
  TransferTransaction,
  AggregateTransaction,
  PlainMessage,
  Deadline,
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
import { nemVoter } from './nemVoter';
import { nemBlockService } from '../services/block.service';

const groupBy = key => array =>
  array.reduce(
    (objectsByKeyValue, obj) => ({
      ...objectsByKeyValue,
      [obj[key]]: (objectsByKeyValue[obj[key]] || []).concat(obj)
    }),
    {}
  );

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

      const saveMosaicIdTransferTransaction = nemTransactionService.transferTransaction(eventElectoralAddress, [], PlainMessage.create(message));

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

      if (finished)
        return { finished: false, data: [{ electoralEvent: "evento electoral ya ha finalizado" }] }


      let message = JSON.stringify({
        code: CodeTypes.FinishElectoralEvent,
      });

      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

      const electoralEventAddress = electoralEventPublicAccount.address;


      const electoralEventFinishTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], PlainMessage.create(message));
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

      const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data;

      const dateFormat: string = "DD-MM-YYYY H:mm";
      const today = moment();

      const startDateActiveElectoralEvent = moment(electoralEvent.startDateActiveElectoralEvent, dateFormat);
      const endDateActiveElectoralEvent = moment(electoralEvent.endDateActiveElectoralEvent, dateFormat);
      // if (startDateActiveElectoralEvent.isAfter(today))
      //   return { created: false, data: "no ha iniciado el proceso de activación de evento electoral" }

      // if (endDateActiveElectoralEvent.isBefore(startDateActiveElectoralEvent))
      //   return { created: false, data: "ya finalizó el proceso de activación de evento electoral" }

      const elections = await nemElection.getAll(electoralEventPublicKey);
      if (elections.length === 0)
        return { activated: false, data: [{ electoralEvent: "evento electoral no tiene elecciones asociadas" }] }

      const electoralRegister = await nemElectoralRegister.exist(electoralEventPublicKey);
      if (!electoralRegister)
        return { activated: false, data: [{ electoralEvent: "evento electoral no tiene registro electoral asociado" }] }

      const electoralEventAddress = electoralEventPublicAccount.address;

      await this.createMosaicToVote(electoralEventAddress);

      nemElectoralRegister.activate(electoralEventPublicKey);

      return { activated: true, data: "evento electoral activado" }
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
        return payload.data;
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
      if (electoralEvent) {
        const electoralEventPublicKey = nemAccountService.generatePublicKey(electoralEvent.name.toLowerCase());
        const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
        const activePromise = nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);
        const finishedPromise = nemElectoralEvent.finished(electoralEventPublicAccount);
        await Promise.all([activePromise, finishedPromise])
          .then(([active, finished]) => {
            electoralEvent['active'] = active ? true : false;
            electoralEvent['finished'] = finished ? true : false;
            electoralEvents.push(electoralEvent);
          })
      }
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
    const dateFormat: string = "DD-MM-YYYY H:mm";

    if (!electoralEvent.hasOwnProperty("name")) {
      valid = false;
      errors.push({ name: "name is required" });
    }
    else if (electoralEvent.name === "") {
      valid = false;
      errors.push({ name: "name can not be empty" });
    }

    if (!electoralEvent.hasOwnProperty("startDateCreateElection")) {
      valid = false;
      errors.push({ startDateCreateElection: "fecha de inicio crear elecciones es requerido" });
    }
    else if (electoralEvent.startDateCreateElection === "") {
      valid = false;
      errors.push({ startDateCreateElection: "fecha de inicio crear elecciones no puede estar vacio" });
    }
    else if (moment(electoralEvent.startDateCreateElection, dateFormat).format(dateFormat) !== electoralEvent.startDateCreateElection) {
      valid = false;
      errors.push({ startDateCreateElection: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("endDateCreateElection")) {
      valid = false;
      errors.push({ endDateCreateElection: "fecha de fin crear elecciones es requerido" });
    }
    else if (electoralEvent.endDateCreateElection === "") {
      valid = false;
      errors.push({ endDateCreateElection: "fecha de fin crear elecciones no puede estar vacio" });
    }
    else if (moment(electoralEvent.endDateCreateElection, dateFormat).format(dateFormat) !== electoralEvent.endDateCreateElection) {
      valid = false;
      errors.push({ endDateCreateElection: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("startDateCreateElectoralRegister")) {
      valid = false;
      errors.push({ startDateCreateElectoralRegister: "fecha de inicio crear registro electoral es requerido" });
    }
    else if (electoralEvent.startDateCreateElectoralRegister === "") {
      valid = false;
      errors.push({ startDateCreateElectoralRegister: "fecha de inicio crear registro electoral no puede estar vacio" });
    }
    else if (moment(electoralEvent.startDateCreateElectoralRegister, dateFormat).format(dateFormat) !== electoralEvent.startDateCreateElectoralRegister) {
      valid = false;
      errors.push({ startDateCreateElectoralRegister: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("endDateCreateElectoralRegister")) {
      valid = false;
      errors.push({ endDateCreateElectoralRegister: "fecha de fin crear registro electoral es requerido" });
    }
    else if (electoralEvent.endDateCreateElectoralRegister === "") {
      valid = false;
      errors.push({ endDateCreateElectoralRegister: "fecha de fin crear registro electoral no puede estar vacio" });
    }
    else if (moment(electoralEvent.endDateCreateElectoralRegister, dateFormat).format(dateFormat) !== electoralEvent.endDateCreateElectoralRegister) {
      valid = false;
      errors.push({ endDateCreateElectoralRegister: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("startDateRegisterCandidate")) {
      valid = false;
      errors.push({ startDateRegisterCandidate: "fecha de inicio crear candidatos es requerido" });
    }
    else if (electoralEvent.startDateRegisterCandidate === "") {
      valid = false;
      errors.push({ startDateRegisterCandidate: "fecha de inicio crear candidatos no puede estar vacio" });
    }
    else if (moment(electoralEvent.startDateRegisterCandidate, dateFormat).format(dateFormat) !== electoralEvent.startDateRegisterCandidate) {
      valid = false;
      errors.push({ startDateRegisterCandidate: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("endDateRegisterCandidate")) {
      valid = false;
      errors.push({ endDateRegisterCandidate: "fecha de fin crear candidatos es requerido" });
    }
    else if (electoralEvent.endDateRegisterCandidate === "") {
      valid = false;
      errors.push({ endDateRegisterCandidate: "fecha de fin crear candidatos no puede estar vacio" });
    }
    else if (moment(electoralEvent.endDateRegisterCandidate, dateFormat).format(dateFormat) !== electoralEvent.endDateRegisterCandidate) {
      valid = false;
      errors.push({ endDateRegisterCandidate: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("startDateActiveElectoralEvent")) {
      valid = false;
      errors.push({ startDateActiveElectoralEvent: "fecha de inicio activar evento electoral es requerido" });
    }
    else if (electoralEvent.startDateActiveElectoralEvent === "") {
      valid = false;
      errors.push({ startDateActiveElectoralEvent: "fecha de inicio activar evento electoral no puede estar vacio" });
    }
    else if (moment(electoralEvent.startDateActiveElectoralEvent, dateFormat).format(dateFormat) !== electoralEvent.startDateActiveElectoralEvent) {
      valid = false;
      errors.push({ startDateActiveElectoralEvent: `formato inválido debe ser ${dateFormat}` });
    }

    if (!electoralEvent.hasOwnProperty("endDateActiveElectoralEvent")) {
      valid = false;
      errors.push({ endDateActiveElectoralEvent: "fecha de fin activar evento electoral es requerido" });
    }
    else if (electoralEvent.endDateActiveElectoralEvent === "") {
      valid = false;
      errors.push({ endDateActiveElectoralEvent: "fecha de fin activar evento electoral no puede estar vacio" });
    }
    else if (moment(electoralEvent.endDateActiveElectoralEvent, dateFormat).format(dateFormat) !== electoralEvent.endDateActiveElectoralEvent) {
      valid = false;
      errors.push({ endDateActiveElectoralEvent: `formato inválido debe ser ${dateFormat}` });
    }

    return { valid, data: errors };
  },

  validDate(electoralEventData: any) {

    const dateFormat: string = "DD-MM-YYYY H:mm";

    const today = moment();
    let valid: boolean = true;
    let errors: any[] = [];

    const startDateCreateElection = moment(electoralEventData.startDateCreateElection);
    const endDateCreateElection = moment(electoralEventData.endDateCreateElection, dateFormat);

    const startDateCreateElectoralRegister = moment(electoralEventData.startDateCreateElectoralRegister, dateFormat);
    const endDateCreateElectoralRegister = moment(electoralEventData.endDateCreateElectoralRegister, dateFormat);

    const startDateRegisterCandidate = moment(electoralEventData.startDateRegisterCandidate, dateFormat);
    const endDateRegisterCandidate = moment(electoralEventData.endDateRegisterCandidate, dateFormat);

    const startDateActiveElectoralEvent = moment(electoralEventData.startDateActiveElectoralEvent, dateFormat);
    const endDateActiveElectoralEvent = moment(electoralEventData.endDateActiveElectoralEvent, dateFormat);

    if (startDateCreateElection.isSameOrBefore(today)) {
      valid = false;
      errors.push({ startDateCreateElection: "la fecha de inicio para la creación de elecciones no puede ser anterior a hoy" })
    }

    if (endDateCreateElection.isBefore(startDateCreateElection)) {
      valid = false;
      errors.push({ startDateCreateElection: "La fecha de fin para la creacion de elecciones no puede ser anterior a la fecha de inicio." })
    }

    if (startDateCreateElectoralRegister.isSameOrBefore(endDateCreateElection)) {
      valid = false;
      errors.push({ startDateCreateElectoralRegister: "la fecha de inicio para crear registro electoral no puede ser antes de la fecha fin de creación de elección" })
    }

    if (endDateCreateElectoralRegister.isBefore(startDateCreateElectoralRegister)) {
      valid = false;
      errors.push({ endDateCreateElectoralRegister: "la fecha de fin para crear registro electoral no puede ser antes de la fecha de inicio" })
    }

    if (startDateRegisterCandidate.isSameOrBefore(endDateCreateElectoralRegister)) {
      valid = false;
      errors.push({ startDateRegisterCandidate: "la fecha de inicio para registrar candidatos no puede ser antes de la fecha fin de creación de registro electoral" })
    }

    if (endDateRegisterCandidate.isBefore(startDateRegisterCandidate)) {
      valid = false;
      errors.push({ endDateRegisterCandidate: "la fecha de fin para registrar candidatos no puede ser antes de la fecha de inicio" })
    }

    if (startDateActiveElectoralEvent.isSameOrBefore(endDateRegisterCandidate)) {
      valid = false;
      errors.push({ startDateActiveElectoralEvent: "la fecha de inicio para activar evento electoral no puede ser antes de la fecha fin de creación de registro de candidatos" })
    }

    if (endDateActiveElectoralEvent.isBefore(startDateActiveElectoralEvent)) {
      valid = false;
      errors.push({ endDateActiveElectoralEvent: "la fecha de fin para activar evento electoral no puede ser antes de la fecha de inicio" })
    }

    return { valid, data: errors }
  },

  async create(electoralEventData: any) {
    try {
      const validData = this.validData(electoralEventData)
      if (!validData.valid)
        return { created: false, data: validData.data }

      const validDate = this.validDate(electoralEventData)
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
          startDateCreateElection: electoralEventData.startDateCreateElection,
          endDateCreateElection: electoralEventData.endDateCreateElection,
          startDateCreateElectoralRegister: electoralEventData.startDateCreateElectoralRegister,
          endDateCreateElectoralRegister: electoralEventData.endDateCreateElectoralRegister,
          startDateRegisterCandidate: electoralEventData.startDateRegisterCandidate,
          endDateRegisterCandidate: electoralEventData.endDateRegisterCandidate,
          startDateActiveElectoralEvent: electoralEventData.startDateActiveElectoralEvent,
          endDateActiveElectoralEvent: electoralEventData.endDateActiveElectoralEvent,
        }
      });

      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
      const electoralEventAddress = electoralEventPublicAccount.address;

      const electoralEventCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], PlainMessage.create(message));
      const electoralEventCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralEventCreateTransferTransaction);
      await nemTransactionService.announceTransactionAsync(electoralEventAddress, electoralEventCreateSignedTransaction);

      const response = { created: true, data: { electoralEventHashTransaction: electoralEventCreateSignedTransaction.hash } };

      return response;
    }
    catch (error) {
      throw (error);
    }
  },

  isTotalize(electoralEventPublicAccount: any) {
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction,
      (transactionElectoralEvent: TransferTransaction): any => {
        const payload = JSON.parse(transactionElectoralEvent.message.payload);
        if (payload.code === CodeTypes.TotalizeElectoralEvent) {
          if (nemElectoralCommission.validateTransaction(transactionElectoralEvent)) {
            return transactionElectoralEvent;
          }
        }

        return false
      });
  },

  async totalize(electoralEventPublickey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    const finalizedElectionTransaction = await nemElectoralEvent.finished(electoralEventPublicAccount);
    if (!finalizedElectionTransaction) {
      return { totalize: false, data: "Evento electoral no ha finalizado" }
    }

    const isTotalizeElectionTransaction = await nemElectoralEvent.isTotalize(electoralEventPublicAccount);
    if (isTotalizeElectionTransaction) {
      return { totalize: false, data: "Evento electoral ya fue totalizado" }
    }

    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

    const elections = await nemElection.getAll(electoralEventPublickey);
    let candidatesVotesTransactionPromise = [];

    let electoralEventDate = {
      start: undefined,
      end: undefined,
    };

    const mosaicVoteTransaction = await nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);

    const blockMosaicVoteTransaction = await nemBlockService.getBlockByHeight(mosaicVoteTransaction.transactionInfo.height.compact());
    electoralEventDate.start = blockMosaicVoteTransaction.timestamp.compact() + (Deadline.timestampNemesisBlock * 1000);

    const blockFinalizedElectionTransaction = await nemBlockService.getBlockByHeight(finalizedElectionTransaction.transactionInfo.height.compact());
    electoralEventDate.end = blockFinalizedElectionTransaction.timestamp.compact() + (Deadline.timestampNemesisBlock * 1000);

    for (const election of elections) {
      const electionVotePublicAccount = nemAccountService.getDeterministicPublicAccount(`${election.id} - Votos`.toLowerCase());
      let votes = await nemElection.getVotes(electionVotePublicAccount, election.id, electoralEventDate);
      if (votes.length === 0)
        continue;

      votes = await Promise.all(votes);
      votes = [].concat.apply([], votes);
      const groupByID = groupBy('identityDocument');
      votes = groupByID(votes);
      let candidates = [];
      for (const identityDocument in votes) {
        if (votes.hasOwnProperty(identityDocument)) {
          const candidate = {
            identityDocument,
            votes: votes[identityDocument].length,
            electionId: election.id
          }
          candidates.push(candidate);
        }
      }
      const candidatesVoteSignedTransaction = nemVoter.sendVotesToCandidates(candidates, electoralCommissionAccount);
      candidatesVotesTransactionPromise.push(nemTransactionService.announceTransactionAsync(electoralCommissionAccount.address, candidatesVoteSignedTransaction));
    }
    await Promise.all(candidatesVotesTransactionPromise);

    const electoralEventAddress = electoralEventPublicAccount.address;

    let message = JSON.stringify({
      code: CodeTypes.TotalizeElectoralEvent
    })
    const electoralEventCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], PlainMessage.create(message));
    const electoralEventCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralEventCreateTransferTransaction);
    await nemTransactionService.announceTransactionAsync(electoralEventAddress, electoralEventCreateSignedTransaction);

    return { totalize: true, data: "Evento electoral totalizado" }

  }
}