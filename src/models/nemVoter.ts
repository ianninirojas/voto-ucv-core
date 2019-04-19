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

  async getMosaicToVoteQuantity(address: Address, mosaicIdToVote: MosaicId) {
    const url = 'http://54.178.241.129:3000';
    const accountHttp = new AccountHttp(url);
    const infoAccount = await accountHttp.getAccountInfo(address).toPromise();
    const mosaic = infoAccount.mosaics.find(mosaic => mosaic.id.equals(mosaicIdToVote));
    if (mosaic) {
      return mosaic.amount.compact();
    }
    else {
      return 0
    }
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

  // 2. Verificar que el voter no haya votado
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
  async incrementMosaicVote(numberVotes: number, mosaicIdVote: any, electoralCommissionAccount: Account) {
    const mosaicSupplyChangeTransaction = nemMosaicService.mosaicSupplyChangeTransaction(mosaicIdVote, MosaicSupplyType.Increase, UInt64.fromUint(numberVotes))
    const mosaicSupplyChangeSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, mosaicSupplyChangeTransaction);

    await nemTransactionService.announceTransaction(mosaicSupplyChangeSignedTransaction);
    return nemTransactionService.awaitTransactionConfirmed(electoralCommissionAccount.address, mosaicSupplyChangeSignedTransaction)
  },

  // 5. Enviar fee+token a la direccion random del voter  
  async sendVoteFeeToVoter(mosaicsVoter: any, voterAccountAddress: Address, electoralCommissionAccount: Account) {
    const message = JSON.stringify({
      code: CodeTypes.TransferMosaicToVote
    })
    const voteFeeVoterTransferTransaction = nemTransactionService.transferTransaction(voterAccountAddress, mosaicsVoter, message);
    const voteFeeVoterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, voteFeeVoterTransferTransaction);

    await nemTransactionService.announceTransaction(voteFeeVoterSignedTransaction);
    return nemTransactionService.awaitTransactionConfirmed(voterAccountAddress, voteFeeVoterSignedTransaction)
  },

  // 6. Enviar voto a la direccion del candidato
  async sendVotesToCandidates(candidates: any[], voterAccount: Account, electoralCommissionAccount: Account, mosaicVote: any, ) {
    const message = JSON.stringify({
      code: CodeTypes.Vote
    })

    let innerTransactionCandidateVote = candidates.map((candidate: any) => {
      const candidateAddress = nemAccountService.getDeterministicPublicAccount(`${candidate.electionId}${candidate.identityDocument}`).address;
      const candidateVoteTransferTransaction = nemTransactionService.transferTransaction(candidateAddress, [mosaicVote], message);
      return candidateVoteTransferTransaction.toAggregate(voterAccount.publicAccount);
    });

    const voterAlreadyVoteTransferTransaction = nemTransactionService.transferTransaction(voterAccount.address, [], message);
    innerTransactionCandidateVote.push(voterAlreadyVoteTransferTransaction.toAggregate(electoralCommissionAccount.publicAccount));

    const candidatesVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactionCandidateVote, []);
    const cosignatories: Account[] = [electoralCommissionAccount];

    const candidatesVoteSignedTransaction = nemTransactionService.signTransactionWithCosignatories(voterAccount, cosignatories, candidatesVoteAggregateTransaction);

    await nemTransactionService.announceTransaction(candidatesVoteSignedTransaction);
    return nemTransactionService.awaitTransactionConfirmed(voterAccount.address, candidatesVoteSignedTransaction);
  },

  async vote(voterAccount: Account, electoralEventPublickey: string, elections: any) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
    console.log('voterAccount.publicKey :', voterAccount.publicKey);
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

    let candidates = [];
    for (const election of elections) {
      const electionId = election.id;
      const typeCandidate = election.typeCandidate;
      const selectedCandidate = election.selectedCandidate;
      if (typeCandidate === TypeCandidate.uninominal) {
        selectedCandidate['electionId'] = electionId;
        candidates.push(selectedCandidate);
      }
      else if (typeCandidate === TypeCandidate.list) {
        candidates = candidates.concat(selectedCandidate.map(candidate => { candidate['electionId'] = electionId; return candidate }));
      }
    }

    const numberVotes: number = candidates.length;

    // PASO 4
    const fee = this.calculateVoteFee([new Mosaic(mosaicIdToVote, UInt64.fromUint(1))], numberVotes);
    const nemFee = NetworkCurrencyMosaic.createRelative(fee);
    const mosaicVoteToVoter = new Mosaic(mosaicIdToVote, UInt64.fromUint(numberVotes));
    const mosaicsVoter = [mosaicVoteToVoter, nemFee];
    const mosaicVoteToCandidate = new Mosaic(mosaicIdToVote, UInt64.fromUint(1));

    try {
      const voterHaveMosaic = await this.voterHaveMosaic(voterAccount);
      if (voterHaveMosaic) {
        console.log('1');
        // PASO 3
        console.log('incrementar token', numberVotes);
        await this.incrementMosaicVote(numberVotes, mosaicIdToVote, electoralCommissionAccount);

        // PASO 5
        console.log('token a votante :', mosaicsVoter);
        await this.sendVoteFeeToVoter(mosaicsVoter, voterAccount.address, electoralCommissionAccount);
      }
      console.log('2');
      //  PASO 6
      console.log('to candidates');
      await this.sendVotesToCandidates(candidates, voterAccount, electoralCommissionAccount, mosaicVoteToCandidate);
      console.log('termino');
      return { voted: true, data: "Listo" }
    }
    catch (error) {
      console.log('error :', error);
      throw (error)
    }
  },
}