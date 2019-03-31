// modules
import {
  Mosaic,
  Account,
  Address,
  Deadline,
  AccountHttp,
  QueryParams,
  Transaction,
  NetworkType,
  PlainMessage,
  PublicAccount,
  TransactionHttp,
  InnerTransaction,
  SignedTransaction,
  TransferTransaction,
  AggregateTransaction,
  AggregateTransactionCosignature
} from 'nem2-sdk';

import { timeout, filter, mergeMap, skip, first, map } from "rxjs/operators";

// models

import { nemElectoralCommission } from "../models/nemElectoralCommission";

// services
import { listenerService } from "../services/nem.listener.service";
import { resolve } from 'dns';

export const nemTransactionService = {

  transferTransaction(recipent: Address, mosaics: Mosaic[], message: string) {
    return TransferTransaction.create(
      Deadline.create(),
      recipent,
      mosaics,
      PlainMessage.create(message),
      recipent.networkType
    );
  },

  aggregateTransaction(innerTransactions: InnerTransaction[], cosignatures: AggregateTransactionCosignature[]) {
    return AggregateTransaction.createComplete(
      Deadline.create(),
      innerTransactions,
      NetworkType.MIJIN_TEST,
      cosignatures
    );
  },

  signTransaction(signer: Account, transaction: Transaction) {
    return signer.sign(transaction);
  },

  announceTransaction(signedTransaction: SignedTransaction) {
    const transactionHttp = new TransactionHttp('http://127.0.0.1:3000');
    return transactionHttp.announce(signedTransaction).toPromise();
  },

  getTransaction(hashTransaction: string) {
    const transactionHttp = new TransactionHttp('http://127.0.0.1:3000');
    return transactionHttp.getTransaction(hashTransaction).toPromise();
  },

  getTransactions(publicAccount: PublicAccount, pageSize: number, id: string | undefined) {
    const accountHttp = new AccountHttp('http://127.0.0.1:3000');
    const queryParam = new QueryParams(pageSize, id);
    return accountHttp.transactions(publicAccount, queryParam).toPromise();
  },

  awaitTransactionConfirmed(address: Address, signedTransaction: SignedTransaction) {

    const listener = new listenerService();
    const amountOfConfirmationsToSkip = 4;

    return new Promise((resolve, reject) => {
      listener.open().then(() => {
        const newBlockSubscription = listener.newBlock()
          .pipe(timeout(100000)) // time in milliseconds when to timeout.
          .subscribe(
            block => {
              console.log("New block created:" + block.height.compact());
            },
            error => {              
              console.error("newBlockSubscription", error);
              newBlockSubscription.unsubscribe();
              listener.terminate();
              reject(error);
            }
          );

        listener.status(address)
          .pipe(filter(error => error.hash === signedTransaction.hash))
          .subscribe(error => {
            console.log("status, error:" + error.status);
            newBlockSubscription.unsubscribe();
            listener.terminate();
            reject(error);
          },
            error => {
              console.error(error);
              newBlockSubscription.unsubscribe();
              listener.terminate();
              reject(error);
            }
          );

        listener.unconfirmedAdded(address)
          .pipe(filter(transaction => (transaction.transactionInfo !== undefined
            && transaction.transactionInfo.hash === signedTransaction.hash)))
          .subscribe(_ => {
            console.log("⏳: Transaction status changed to unconfirmed")
          },
            error => {
              console.error('unconfirmedAdded', error);
              newBlockSubscription.unsubscribe();
              listener.terminate();
              reject(error);
            }
          );

        listener.confirmed(address)
          .pipe(
            filter(transaction => (transaction.transactionInfo !== undefined
              && transaction.transactionInfo.hash === signedTransaction.hash)),
            mergeMap(transaction => {
              return listener.newBlock()
                .pipe(
                  skip(amountOfConfirmationsToSkip),
                  first(),
                  map(_ => transaction))
            })
          )
          .subscribe(_ => {
            newBlockSubscription.unsubscribe();
            listener.terminate();
            console.log("✅: Transaction confirmed");
            resolve(true);
          },
            error => {
              console.error('confirmed', error);
              newBlockSubscription.unsubscribe();
              listener.terminate();
              reject(error);
            }
          );
      });
    });
  },

  async searchTransaction(publicAccount: PublicAccount, typeTransaction: any, check: (tx: any) => any) {
    let lastId = undefined;
    let transactions = await nemTransactionService.getTransactions(publicAccount, 100, lastId).catch(error => { throw new Error(error) });
    while (transactions.length !== 0) {
      for (const transaction of transactions) {
        if (transaction instanceof typeTransaction) {
          const response = check(transaction);
          if (response)
            return response
        }
      }
      const lastTransaction = transactions.pop();
      if (lastTransaction) {
        if (lastTransaction.transactionInfo) {
          lastId = lastTransaction.transactionInfo.id
          transactions = await nemTransactionService.getTransactions(publicAccount, 100, lastId);
        }
      }
    }
    return false
  },

  async searchTransactions(publicAccount: PublicAccount, typeTransaction: any, check: (tx: any) => any) {
    let lastId = undefined;
    let transactions = await nemTransactionService.getTransactions(publicAccount, 100, lastId);
    let transactionsResponse = [];
    while (transactions.length !== 0) {
      for (const transaction of transactions) {
        if (transaction instanceof typeTransaction) {
          const response = check(transaction);
          if (response)
            transactionsResponse.push(response);
        }
      }
      const lastTransaction = transactions.pop();
      if (lastTransaction) {
        if (lastTransaction.transactionInfo) {
          lastId = lastTransaction.transactionInfo.id
          transactions = await nemTransactionService.getTransactions(publicAccount, 100, lastId);
        }
      }
    }
    return transactionsResponse;
  },
}