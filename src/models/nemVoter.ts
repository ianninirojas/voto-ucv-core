import {
  Account,
  UInt64,
  Mosaic,
  Address,
  PublicAccount,
  Password,
  TransferTransaction,
  AccountHttp,
  MosaicSupplyType,
  NetworkCurrencyMosaic
} from 'nem2-sdk';

//Models
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";
import { CodeTypes } from '../constants/codeType';
import { nemElectoralEvent } from './nemElectoralEvent';
import { nemMosaicService } from '../services/nem.mosaic.service';
import { TypeCandidate } from '../constants/typeCandidate';

// Lista de pasos para realizar la votacion
// 1. Verificar que el token haya sido creado
// 2. Verificar que el voter no haya votado
// 3. Modificar la cantidad de token de acuerdo a los votos emitidos
// 4. Calcular fee de para la transaccion del voter
// 5. Enviar fee+token a la direccion random del voter
// 6. Enviar voto a la direccion del candidato

export const nemVoter = {

  getAccount(seed) {
    const { electoralEventPublickey, identityDocument, password, accessCode } = seed
    const privateKey = nemAccountService.generatePrivateKey(`${electoralEventPublickey}${identityDocument}${accessCode}${password}`);
    return nemAccountService.getAccountFromPrivateKey(privateKey);
  },

  async getMosaicToVoteQuantity(address: Address, electoralEventPublickey: string) {
    const url = 'http://localhost:3000';
    const accountHttp = new AccountHttp(url);
    const infoAccount = await accountHttp.getAccountInfo(address).toPromise();
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    const mosaicToVote = await nemElectoralEvent.getMosaicVote(electoralEventPublicAccount)
    const mosaic = infoAccount.mosaics.find(mosaic => mosaic.id.equals(mosaicToVote.mosaicId));
    if (mosaic) {
      return mosaic.amount.compact();
    }
    else {
      return 0
    }
  },

  calculateVoteFee(mosaics: any, numberVotes: any) {
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
    const tx = nemTransactionService.transferTransaction(electoralCommissionAccount.address, mosaics, "");
    return tx.maxFee.compact() * numberVotes;
  },

  // 2. Verificar que el voter no haya votado
  async alreadyVoted(voterAccount: Account, electoralEventPublickey: string) {
    return nemTransactionService.searchTransaction(voterAccount.publicAccount, TransferTransaction,
      async (transactionMosaicToVote: TransferTransaction): Promise<any> => {
        if (nemElectoralCommission.validateTransaction(transactionMosaicToVote)) {
          const payload = JSON.parse(transactionMosaicToVote.message.payload);
          if (transactionMosaicToVote.recipient instanceof Address) {
            if (transactionMosaicToVote.recipient.equals(voterAccount.address)) {
              if (payload.code === CodeTypes.TransferMosaicToVote) {
                if (!this.getMosaicToVoteQuantity(voterAccount.address, electoralEventPublickey)) {
                  return true
                }
              }
            }
          }
        }
        return false;
      });
  },

  // 3. Modificar la cantidad de token de acuerdo a los votos emitidos
  async incrementMosaicVote(numberVotes: number, mosaicIdVote: any, electoralCommissionAccount: Account, electoralEventAddress: Address) {
    const mosaicSupplyChangeTransaction = nemMosaicService.mosaicSupplyChangeTransaction(mosaicIdVote.mosaicId, MosaicSupplyType.Increase, UInt64.fromUint(numberVotes))
    const mosaicSupplyChangeSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, mosaicSupplyChangeTransaction);

    await nemTransactionService.announceTransaction(mosaicSupplyChangeSignedTransaction);
    return nemTransactionService.awaitTransactionConfirmed(electoralEventAddress, mosaicSupplyChangeSignedTransaction)
  },

  // 5. Enviar fee+token a la direccion random del voter  
  async sendVoteFeeToVoter(mosaicsVoter: any, voterAccountAddress: Address, electoralCommissionAccount: Account) {
    const voteFeeVoterTransferTransaction = nemTransactionService.transferTransaction(voterAccountAddress, mosaicsVoter, "");
    const voteFeeVoterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, voteFeeVoterTransferTransaction);
    await nemTransactionService.announceTransaction(voteFeeVoterSignedTransaction);

    return nemTransactionService.awaitTransactionConfirmed(voterAccountAddress, voteFeeVoterSignedTransaction)
  },

  // 6. Enviar voto a la direccion del candidato
  async sendVotesToCandidates(candidates: any[], voterAccount: Account, electoralCommissionAccount: Account, mosaicVote: any, ) {
    const innerTransactionCandidateVote = candidates.map((candidate: any) => {
      const candidatePublicAccount = nemAccountService.getDeterministicPublicAccount(`${candidate.electionId}${candidate.ci}`);
      const candidateVoteTransferTransaction = nemTransactionService.transferTransaction(candidatePublicAccount.address, [mosaicVote], "");
      return candidateVoteTransferTransaction.toAggregate(voterAccount.publicAccount);
    });

    const candidatesVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactionCandidateVote, []);
    const cosignatories: Account[] = [electoralCommissionAccount];
    const candidatesVoteSignedTransaction = nemTransactionService.signTransactionWithCosignatories(voterAccount, cosignatories, candidatesVoteAggregateTransaction);
    await nemTransactionService.announceTransaction(candidatesVoteSignedTransaction);
    return nemTransactionService.awaitTransactionConfirmed(voterAccount.address, candidatesVoteSignedTransaction)
  },

  async vote(voterAccount: Account, electoralEventPublickey: string, elections: any) {

    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

    // PASO 1
    const isItTimeToVote = await nemElectoralEvent.isItTimeToVote(electoralEventPublickey);
    if (!isItTimeToVote) {
      return { voted: false, data: "No se puede votar" }
    }

    // PASO 2
    const alreadyVoted = await this.alreadyVoted(voterAccount, electoralCommissionAccount.publicAccount);
    if (alreadyVoted)
      return { voted: false, data: "Ya votó" }

    let candidates = [];
    for (const election of elections) {
      const electionId = election.id;
      const typeCandidate = election.typeCandidate;
      const selectedCandidate = election.selectedCandidate;
      if (typeCandidate === TypeCandidate.list) {
        selectedCandidate['electionId'] = electionId;
        candidates.push(selectedCandidate);
      }
      else if (typeCandidate === TypeCandidate.uninominal) {
        candidates = candidates.concat(selectedCandidate.map(_ => _['electionId'] = electionId));
      }
    }

    const mosaicIdVote = await nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);
    const numberVotes: number = candidates.length;

    const electoralEventAddress = electoralEventPublicAccount.address;

    try {
      // PASO 3
      await this.incrementMosaicVote(numberVotes, mosaicIdVote, electoralCommissionAccount, electoralEventAddress);

      // PASO 4
      let mosaicFee = null;
      mosaicFee = [{ mosaicId: mosaicIdVote, quantity: 1 }];
      const fee = this.calculateVoteFee(mosaicFee, numberVotes);
      mosaicFee = NetworkCurrencyMosaic.createRelative(fee);

      // PASO 5
      const mosaicVote = new Mosaic(mosaicIdVote, UInt64.fromUint(numberVotes));
      const mosaicsVoter = [mosaicVote, mosaicFee];

      await this.sendVoteFeeToVoter(mosaicsVoter, voterAccount.address, electoralCommissionAccount);

      //  PASO 6
      await this.sendVotesToCandidates(candidates, voterAccount, electoralCommissionAccount, mosaicVote);

      return { voted: true, data: "Listo" }
    }
    catch (error) {
      throw (error)
    }
  },
}