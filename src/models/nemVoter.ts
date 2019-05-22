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
  AggregateTransaction,
  EncryptedMessage,
  PlainMessage
} from 'nem2-sdk';

//Models
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";
import { CodeTypes } from '../constants/codeType';
import { nemElectoralEvent } from './nemElectoralEvent';
import { nemMosaicService } from '../services/nem.mosaic.service';
import { nemElectoralRegister } from './nemElectoralRegister';
// Lista de pasos para realizar la votacion
// 1. Verificar que el token haya sido creado
// 2. Verificar que el voter no haya votado
// 3. Modificar la cantidad de token de acuerdo a los votos emitidos
// 4. Calcular fee de para la transaccion del voter
// 5. Enviar fee+token a la direccion random del voter
// 6. Enviar voto a la direccion de la eleccion que almacena los votos

export const nemVoter = {

  getAccount(seed) {
    const { electoralEventPublickey, identityDocument, password, accessCode } = seed
    const privateKey = nemAccountService.generatePrivateKey(`${electoralEventPublickey}${identityDocument}${accessCode}${password}`);
    return nemAccountService.getAccountFromPrivateKey(privateKey);
  },

  calculateVoteFee(mosaics: any, numberVotes: any) {
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
    const tx = nemTransactionService.transferTransaction(electoralCommissionAccount.address, mosaics, PlainMessage.create(''));
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
    const voteFeeVoterTransferTransaction = nemTransactionService.transferTransaction(voterAccountAddress, mosaicsVoter, PlainMessage.create(message));
    const voteFeeVoterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, voteFeeVoterTransferTransaction);
    return voteFeeVoterSignedTransaction
  },

  // 6. Enviar voto a la direccion de la eleccion que almacena los votos
  sendVotesToCandidates(candidates: any[], electoralCommissionAccount: Account) {
    let innerTransactionCandidateVote = candidates.map((candidate: any) => {
      const message = JSON.stringify({
        code: CodeTypes.Vote,
        data: {
          votes: candidate.votes
        }
      })
      const candidateAddress = nemAccountService.getDeterministicPublicAccount(`${candidate.electionId}${candidate.identityDocument}`).address;
      const candidateVoteTransferTransaction = nemTransactionService.transferTransaction(candidateAddress, [], PlainMessage.create(message));
      return candidateVoteTransferTransaction.toAggregate(electoralCommissionAccount.publicAccount);
    });
    const message = JSON.stringify({
      code: CodeTypes.Vote
    })
    const voterAlreadyVoteTransferTransaction = nemTransactionService.transferTransaction(electoralCommissionAccount.address, [], PlainMessage.create(message));
    innerTransactionCandidateVote.push(voterAlreadyVoteTransferTransaction.toAggregate(electoralCommissionAccount.publicAccount));

    const candidatesVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactionCandidateVote, []);

    const candidatesVoteSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, candidatesVoteAggregateTransaction);
    return candidatesVoteSignedTransaction;
  },

  sendVote(elections: any, voterAccount: Account, electoralCommissionAccount: Account, mosaicVote: any) {
    const electionVoteTransactions = []
    for (const election of elections) {
      for (const candidate of election.candidates) {
        const message = JSON.stringify({
          identityDocument: candidate.identityDocument,
          electionId: candidate.electionId,
        });
        const electionVotePublicAccount = nemAccountService.getDeterministicPublicAccount(`${election.id} - Votos`.toLowerCase());
        const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
        const encryptedVote = EncryptedMessage.create(message, electionVotePublicAccount, electoralCommissionPrivateKey);
        const electionVoteTransaction = nemTransactionService.transferTransaction(electionVotePublicAccount.address, [], encryptedVote).toAggregate(voterAccount.publicAccount);
        electionVoteTransactions.push(electionVoteTransaction);
      }
    }

    const message = JSON.stringify({
      code: CodeTypes.Vote
    });

    const voterAlreadyVoteTransferTransaction = nemTransactionService.transferTransaction(voterAccount.address, [], PlainMessage.create(message)).toAggregate(electoralCommissionAccount.publicAccount);
    const innerTransactions = [...electionVoteTransactions, voterAlreadyVoteTransferTransaction];
    const cosignatories: Account[] = [electoralCommissionAccount];
    const electionVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactions, []);
    const electionVoteSignedTransaction = nemTransactionService.signTransactionWithCosignatories(voterAccount, cosignatories, electionVoteAggregateTransaction);
    return electionVoteSignedTransaction;
  },

  async vote(identityDocument: string, voterAccount: Account, electoralEventPublickey: string, elections: any) {
    try {
      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

      const electoralRegisterPublicAccount = nemAccountService.getDeterministicPublicAccount(`${electoralEventPublickey} - Registro Electoral`.toLowerCase());
      const validElector = await nemElectoralRegister.validateElector(electoralRegisterPublicAccount.publicKey, identityDocument);

      if (!validElector) {
        return { voted: false, data: "No está incluido en el registro electoral" }
      }

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
      const mosaicSupplyChangeSignedTransaction = this.incrementMosaicVote(1, mosaicIdToVote, electoralCommissionAccount);
      // PASO 4
      const fee = this.calculateVoteFee([new Mosaic(mosaicIdToVote, UInt64.fromUint(1))], 1);
      const nemFee = NetworkCurrencyMosaic.createRelative(fee);
      const mosaicVoteToVoter = new Mosaic(mosaicIdToVote, UInt64.fromUint(1));
      const mosaicsVoter = [mosaicVoteToVoter, nemFee];
      const mosaicVote = new Mosaic(mosaicIdToVote, UInt64.fromUint(1));

      // PASO 5 
      const voteFeeVoterSignedTransaction = this.sendVoteFeeToVoter(mosaicsVoter, voterAccount.address, electoralCommissionAccount);

      //  PASO 6
      const voteSignedTransaction = this.sendVote(elections, voterAccount, electoralCommissionAccount, mosaicVote);
      // const candidatesVoteSignedTransaction = this.sendVotesToCandidates(candidates, voterAccount, electoralCommissionAccount, mosaicVoteToCandidate);
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
      await nemTransactionService.announceTransactionAsync(voterAccount.address, voteSignedTransaction);
      return { voted: true, data: "Listo" }
    }
    catch (error) {
      console.log('error :', error);
      throw (error);
    }

  }
}