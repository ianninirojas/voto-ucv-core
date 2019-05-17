import {
  Account,
  UInt64,
  Mosaic,
  Address,
  PublicAccount,
  TransferTransaction,
  AccountHttp,
  MosaicSupplyType,
  NetworkCurrencyMosaic,
  MosaicId,
  AggregateTransaction
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
import { listenerService } from '../services/nem.listener.service';

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

  calculateVoteFee(mosaics: any, numberVotes: any) {
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
    const tx = nemTransactionService.transferTransaction(electoralCommissionAccount.address, mosaics, "");
    return tx.maxFee.compact() * numberVotes;
  },

  voterHaveMosaic(voterAccount: Account) {
    return nemTransactionService.searchTransaction(voterAccount.publicAccount, TransferTransaction,
      (transactionMosaicToVote: TransferTransaction): boolean => {
        if (nemElectoralCommission.validateTransaction(transactionMosaicToVote)) {
          const payload = JSON.parse(transactionMosaicToVote.message.payload);
          if (transactionMosaicToVote.recipient.equals(voterAccount.address)) {
            if (payload.code === CodeTypes.TransferMosaicToVote) {
              return true;
            }
          }
        }
        return false;
      });
  },

  // 2. Verificar que votante no haya votado
  alreadyVoted(voterPublicAccount: PublicAccount) {
    return nemTransactionService.searchTransaction(voterPublicAccount, AggregateTransaction,
      (voteTransaction: any): any => {
        for (const innerTransaction of voteTransaction.innerTransactions) {
          const payload = JSON.parse(innerTransaction.message.payload);
          if (payload.code === CodeTypes.Vote) {
            if (nemElectoralCommission.validateTransaction(innerTransaction)) {
              return true;
            }
          }
        }
        return false;
      });
  },

  // 3. Modificar la cantidad de token de acuerdo a los votos emitidos
  incrementMosaicVote(numberVotes: number, mosaicIdVote: any, electoralCommissionAccount: Account) {
    const mosaicSupplyChangeTransaction = nemMosaicService.mosaicSupplyChangeTransaction(mosaicIdVote, MosaicSupplyType.Increase, UInt64.fromUint(numberVotes))
    const mosaicSupplyChangeSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, mosaicSupplyChangeTransaction);
    return mosaicSupplyChangeSignedTransaction;
  },

  // 5. Enviar fee+token a la direccion del votante  
  sendVoteFeeToVoter(mosaicsVoter: any, voterAccountAddress: Address, electoralCommissionAccount: Account) {
    const message = JSON.stringify({
      code: CodeTypes.TransferMosaicToVote
    })
    const voteFeeVoterTransferTransaction = nemTransactionService.transferTransaction(voterAccountAddress, mosaicsVoter, message);
    const voteFeeVoterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, voteFeeVoterTransferTransaction);
    return voteFeeVoterSignedTransaction
  },

  // 6. Enviar voto a respectivos candidatos
  sendVotesToCandidates(candidates: any[], voterAccount: Account, electoralCommissionAccount: Account, mosaicVote: any, ) {
    const message = JSON.stringify({
      code: CodeTypes.Vote
    })

    let innerTransactionCandidateVote = candidates.map((candidate: any) => {
      const candidateAddress = nemAccountService.getDeterministicPublicAccount(`${candidate.electionId}${candidate.identityDocument}`).address;
      const candidateVoteTransferTransaction = nemTransactionService.transferTransaction(candidateAddress, [mosaicVote], '');
      return candidateVoteTransferTransaction.toAggregate(voterAccount.publicAccount);
    });

    const voterAlreadyVoteTransferTransaction = nemTransactionService.transferTransaction(voterAccount.address, [], message);
    innerTransactionCandidateVote.push(voterAlreadyVoteTransferTransaction.toAggregate(electoralCommissionAccount.publicAccount));

    const candidatesVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactionCandidateVote, []);
    const cosignatories: Account[] = [electoralCommissionAccount];

    const candidatesVoteSignedTransaction = nemTransactionService.signTransactionWithCosignatories(voterAccount, cosignatories, candidatesVoteAggregateTransaction);
    return candidatesVoteSignedTransaction;
  },

  async vote(voterAccount: Account, electoralEventPublickey: string, candidates: any) {
    try {
      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

      // PASO 1
      const isItTimeToVote = await nemElectoralEvent.isItTimeToVote(electoralEventPublickey);
      if (!isItTimeToVote) {
        return { voted: false, data: "No se puede votar" }
      }

      const mosaicToVoteTransaction = await nemElectoralEvent.getMosaicVote(electoralEventPublicAccount)
      const mosaicIdHex = JSON.parse(mosaicToVoteTransaction.message.payload).data.mosaicIdHex;
      const mosaicIdToVote = new MosaicId(mosaicIdHex);

      // PASO 2
      const alreadyVoted = await this.alreadyVoted(voterAccount.publicAccount, mosaicIdToVote);
      if (alreadyVoted)
        return { voted: false, data: "Ya votó" }

      // PASO 3
      const numberVotes: number = candidates.length;
      const mosaicSupplyChangeSignedTransaction = this.incrementMosaicVote(numberVotes, mosaicIdToVote, electoralCommissionAccount);
      // PASO 4
      const fee = this.calculateVoteFee([new Mosaic(mosaicIdToVote, UInt64.fromUint(1))], numberVotes);
      const nemFee = NetworkCurrencyMosaic.createRelative(fee);
      const mosaicVoteToVoter = new Mosaic(mosaicIdToVote, UInt64.fromUint(numberVotes));
      const mosaicsVoter = [mosaicVoteToVoter, nemFee];
      const mosaicVoteToCandidate = new Mosaic(mosaicIdToVote, UInt64.fromUint(1));
      // PASO 5 
      const voteFeeVoterSignedTransaction = this.sendVoteFeeToVoter(mosaicsVoter, voterAccount.address, electoralCommissionAccount);
      //  PASO 6
      const candidatesVoteSignedTransaction = this.sendVotesToCandidates(candidates, voterAccount, electoralCommissionAccount, mosaicVoteToCandidate);

      const voterHaveMosaic = await this.voterHaveMosaic(voterAccount);
      console.log('voterHaveMosaic :', voterHaveMosaic);
      if (!voterHaveMosaic) {
        // PASO 3
        console.log('increment token');
        await nemTransactionService.announceTransactionAsync(electoralCommissionAccount.address, mosaicSupplyChangeSignedTransaction);
        
        // PASO 5      
        console.log('send token to voter');
        await nemTransactionService.announceTransactionAsync(voterAccount.address, voteFeeVoterSignedTransaction);
      }
      //  PASO 6
      console.log('send token to candidate');
      await nemTransactionService.announceTransactionAsync(voterAccount.address, candidatesVoteSignedTransaction);
      return { voted: true, data: "Listo" }
    }
    catch (error) {
      console.log('error :', error);
      throw (error);
    }

  }
}