// modules
import {
  UInt64,
  Mosaic,
  Account,
  Address,
  NetworkType,
  PublicAccount,
  MosaicSupplyType,
  TransferTransaction,
  NetworkCurrencyMosaic
} from 'nem2-sdk';

// entities
import { nemCandidate } from "../models/nemCandidate";
import { nemElectoralEvent } from "../models/nemElectoralEvent";
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { nemMosaicService } from '../services/nem.mosaic.service';
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";

// constans
import { CodeTypes } from "../constants/codeType";

// Lista de pasos para realizar la votacion
// 1. Verificar que el token haya sido creado
// 2. Verificar que el voter no haya votado
// 3. Modificar la cantidad de token de acuerdo a los votos emitidos
// 4. Calcular fee de para la transaccion del voter
// 5. Enviar fee+token a la direccion random del voter
// 6. Enviar voto a la direccion del candidato
// 7. Registrar voter en blockchain

export const votingService = {

  calculateVoteFee(mosaics: any, numberVotes: any) {
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);
    const tx = nemTransactionService.transferTransaction(electoralCommissionAccount.address, mosaics, "");
    return tx.fee.compact() * numberVotes;
    // let mosaicDefinitionMetaDataPair = nem.model.objects.get("mosaicDefinitionMetaDataPair");
    // for (let i = 0; i < mosaics.length; i++) {
    //   const mosaic = mosaics[i];
    //   const mosaicDefinitions = await nem.com.requests.namespace.mosaicDefinitions(ENDPOINT, mosaic.mosaicId.namespaceId);
    //   let fullMosaicName = nem.utils.format.mosaicIdToName(mosaic.mosaicId);
    //   let neededDefinition = nem.utils.helpers.searchMosaicDefinitionArray(mosaicDefinitions.data, [mosaic.mosaicId.name]);
    //   if (undefined === neededDefinition[fullMosaicName]) return console.error("Mosaic not found !");
    //   mosaicDefinitionMetaDataPair[fullMosaicName] = {};
    //   mosaicDefinitionMetaDataPair[fullMosaicName].mosaicDefinition = neededDefinition[fullMosaicName];
    //   const actualSupply = await nem.com.requests.mosaic.supply(ENDPOINT, fullMosaicName);
    //   mosaicDefinitionMetaDataPair[fullMosaicName].supply = actualSupply.supply;
    // }
    // const voteFee = nem.model.fees.calculateMosaics(1, mosaicDefinitionMetaDataPair, mosaics) * 1000000 * numberVotes;
    // return voteFee;
  },

  // 2. Verificar que el voter no haya votado
  async alreadyVoted(ciVoter: string, electoralCommissionPublicAccount: PublicAccount) {
    return nemTransactionService.searchTransaction(electoralCommissionPublicAccount, TransferTransaction, (registerVoterTransaction: any): any => {
      const payload = JSON.parse(registerVoterTransaction.message.payload);
      if (payload.code === CodeTypes.RegisterVoter) {
        if (ciVoter === payload.data.ci) {
          return true;
        }
        else {
          return false;
        }
      }
      else {
        return false;
      }
    });
  },

  // 3. Modificar la cantidad de token de acuerdo a los votos emitidos
  async incrementMosaicVote(numberVotes: number, mosaicIdVote: any, electoralCommissionAccount: Account, electoralEventAddress: Address) {
    const mosaicSupplyChangeTransaction = nemMosaicService.mosaicSupplyChangeTransaction(mosaicIdVote.mosaicId, MosaicSupplyType.Increase, UInt64.fromUint(numberVotes))
    const mosaicSupplyChangeSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, mosaicSupplyChangeTransaction);

    const mosaicSupplyChangeAnnounceTransactionResponse = await nemTransactionService.announceTransaction(mosaicSupplyChangeSignedTransaction);

    if (mosaicSupplyChangeAnnounceTransactionResponse.message !== 'ok')
      return "hubo un error";

    const mosaicSupplyChangeAwaitTransactionConfirmed = await nemTransactionService.awaitTransactionConfirmed(electoralEventAddress, mosaicSupplyChangeSignedTransaction)
    if (!mosaicSupplyChangeAwaitTransactionConfirmed) {
      console.log('hubo un problema')
    }
  },

  // 5. Enviar fee+token a la direccion random del voter  
  async sendVoteFeeToVoter(mosaicsVoter: any, voterAccountAddress: Address, electoralCommissionAccount: Account) {
    const voteFeeVoterTransferTransaction = nemTransactionService.transferTransaction(voterAccountAddress, mosaicsVoter, "");
    const voteFeeVoterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, voteFeeVoterTransferTransaction);
    const voteFeeVoterAnnounceTransactionResponse = await nemTransactionService.announceTransaction(voteFeeVoterSignedTransaction);

    if (voteFeeVoterAnnounceTransactionResponse.message !== 'ok') {
      return 'erro';
    }
    const voteFeeVoterAwaitTransactionConfirmed = await nemTransactionService.awaitTransactionConfirmed(voterAccountAddress, voteFeeVoterSignedTransaction)
    if (!voteFeeVoterAwaitTransactionConfirmed) {
      return 'error';
    }
  },

  // 6. Enviar voto a la direccion del candidato
  async sendVotesToCandidates(candidates: any[], voterAccount: Account, mosaicVote: any, ) {
    const innerTransactionCandidateVote = candidates.map((candidate: any) => {
      const candidatePublicAccount = nemAccountService.getDeterministicPublicAccount(`${candidate.ci} - ${candidate.electionId}`);
      const candidateVoteTransferTransaction = nemTransactionService.transferTransaction(candidatePublicAccount.address, [mosaicVote], "");
      return candidateVoteTransferTransaction.toAggregate(voterAccount.publicAccount);
    });

    const candidatesVoteAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactionCandidateVote, []);
    const candidatesVoteSignedTransaction = nemTransactionService.signTransaction(voterAccount, candidatesVoteAggregateTransaction);
    const candidatesVoteAnnounceTransactionResponse = await nemTransactionService.announceTransaction(candidatesVoteSignedTransaction);

    if (candidatesVoteAnnounceTransactionResponse.message !== 'ok') {
      return 'error';
    }
    const candidatesVoteAwaitTransactionConfirmed = await nemTransactionService.awaitTransactionConfirmed(voterAccount.address, candidatesVoteSignedTransaction)
    if (!candidatesVoteAwaitTransactionConfirmed) {
      return 'error';
    }
  },

  // 7. Enviar voto a la direccion del candidato
  async registerVoter(ciVoter: string, electoralCommissionAccount: Account, voterAccount: Account) {
    const mosaicsToValidateTransaction = [new Mosaic(nemElectoralCommission.getOfficialMosaicId(), UInt64.fromUint(1))];
    const message = JSON.stringify({
      code: CodeTypes.RegisterVoter,
      data: {
        ci: ciVoter,
      }
    });
    const registerVoterTransferTransaction = nemTransactionService.transferTransaction(electoralCommissionAccount.address, mosaicsToValidateTransaction, message);
    const registerVoterSignTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, registerVoterTransferTransaction);
    const registerVoterAnnounceTransactionResponse = await nemTransactionService.announceTransaction(registerVoterSignTransaction);

    if (registerVoterAnnounceTransactionResponse.message !== 'ok') {
      return 'error';
    }
    const registerVoterAwaitTransactionConfirmed = await nemTransactionService.awaitTransactionConfirmed(voterAccount.address, registerVoterSignTransaction)
    if (!registerVoterAwaitTransactionConfirmed) {
      return 'error';
    }
  },

  async vote(ciVoter: any, electoralEventData: any, candidates: any) {

    const electoralEventPublicAccount = nemAccountService.getDeterministicPublicAccount(electoralEventData.name.toLowerCase());
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

    // PASO 1
    const isItTimeToVote = await nemElectoralEvent.isItTimeToVote(electoralEventPublicAccount);
    if (!isItTimeToVote) {
      return 'No es tiempo para votar'
    }

    // PASO 2
    const alreadyVoted = await this.alreadyVoted(ciVoter, electoralCommissionAccount.publicAccount);
    if (alreadyVoted)
      return 'Ya voto';

    const mosaicIdVote = await nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);
    const numberVotes: number = candidates.length;

    const electoralEventAddress = electoralEventPublicAccount.address;

    // PASO 3
    await this.incrementMosaicVote(numberVotes, mosaicIdVote, electoralCommissionAccount, electoralEventAddress);

    // PASO 4
    // https://nemproject.github.io/#transaction-fees
    let mosaicFee = null;
    mosaicFee = [{ mosaicId: mosaicIdVote, quantity: 1 }];
    const fee = await this.calculateVoteFee(mosaicFee, numberVotes);
    mosaicFee = NetworkCurrencyMosaic.createRelative(fee);    

    // PASO 5
    const voterAccount = Account.generateNewAccount(NetworkType.MIJIN_TEST);
    const mosaicVote = new Mosaic(mosaicIdVote, UInt64.fromUint(numberVotes));
    const mosaicsVoter = [mosaicVote, mosaicFee];

    await this.sendVoteFeeToVoter(mosaicsVoter, voterAccount.address, electoralCommissionAccount);

    //  PASO 6
    await this.sendVotesToCandidates(candidates, voterAccount, mosaicVote);

    // PASO 7
    this.registerVoter(ciVoter, electoralCommissionAccount, voterAccount);

    return 'ok';

  },
}