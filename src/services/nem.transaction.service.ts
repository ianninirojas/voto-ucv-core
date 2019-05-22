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
  AggregateTransactionCosignature,
  Message
} from 'nem2-sdk';

import { env } from "../config";

import { timeout, filter, mergeMap, skip, first, map } from "rxjs/operators";

// services
import { listenerService } from "../services/nem.listener.service";

export const nemTransactionService = {

  transferTransaction(recipent: Address, mosaics: Mosaic[], message: Message) {
    return TransferTransaction.create(
      Deadline.create(),
      recipent,
      mosaics,
      message,
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

  signTransactionWithCosignatories(signer: Account, cosignatures: Account[], transaction: AggregateTransaction) {
    return signer.signTransactionWithCosignatories(transaction, cosignatures)
  },

  announceTransaction(signedTransaction: SignedTransaction) {
    const transactionHttp = new TransactionHttp(env.apiNemUrl);
    return transactionHttp.announce(signedTransaction);
  },

  getTransaction(hashTransaction: string) {
    const transactionHttp = new TransactionHttp(env.apiNemUrl);
    return transactionHttp.getTransaction(hashTransaction).toPromise();
  },

  getTransactions(publicAccount: PublicAccount, pageSize: number, id: string | undefined) {
    const accountHttp = new AccountHttp(env.apiNemUrl);
    const queryParam = new QueryParams(pageSize, id);
    return accountHttp.transactions(publicAccount, queryParam).toPromise();
  },

  announceTransactionAsync(address: Address, signedTransaction: SignedTransaction) {
    const listener = new listenerService();
    const amountOfConfirmationsToSkip = 2;
    let announceTransactionSubscribe = undefined;
    return new Promise((resolve, reject) => {
      listener.open().then(() => {
        const newBlockSubscription = listener.newBlock()
          .pipe(timeout(100000)) // time in milliseconds when to timeout.
          .subscribe(
            block => {
              console.log("New block created: " + block.height.compact());
            },
            error => {
              console.error("newBlockSubscription", error);
              newBlockSubscription.unsubscribe();
              if (announceTransactionSubscribe) {
                announceTransactionSubscribe.unsubscribe();
              }
              listener.terminate();
              reject(error.status);
            }
          );

        listener.status(address)
          .pipe(filter(error => error.hash === signedTransaction.hash))
          .subscribe(error => {
            console.log("status, error:" + error.status);
            newBlockSubscription.unsubscribe();
            if (announceTransactionSubscribe) {
              announceTransactionSubscribe.unsubscribe();
            }
            listener.terminate();
            reject(error.status);
          },
            error => {
              console.error(error);
              newBlockSubscription.unsubscribe();
              if (announceTransactionSubscribe) {
                announceTransactionSubscribe.unsubscribe();
              }
              listener.terminate();
              reject(error.status);
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
            if (announceTransactionSubscribe) {
              announceTransactionSubscribe.unsubscribe();
            }
            console.log("✅: Transaction confirmed");
            resolve(true);
          },
            error => {
              console.error('confirmed', error);
              newBlockSubscription.unsubscribe();
              if (announceTransactionSubscribe) {
                announceTransactionSubscribe.unsubscribe();
              }
              listener.terminate();
              reject(error.status);
            }
          );

        announceTransactionSubscribe = this.announceTransaction(signedTransaction)
          .subscribe(
            x => console.log('transaction announce'),
            error => console.error(error));
      });
    });
  },

  async searchTransaction(publicAccount: PublicAccount, typeTransaction: any, check: (tx: any) => any) {
    let lastId = undefined;
    let transactions = await nemTransactionService.getTransactions(publicAccount, 50, lastId).catch(error => { throw (error) });
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
          transactions = await nemTransactionService.getTransactions(publicAccount, 50, lastId);
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