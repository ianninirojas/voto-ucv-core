// modules
import {
  UInt64,
  Account,
  Deadline,
  MosaicId,
  NetworkType,
  MosaicNonce,
  MosaicProperties,
  MosaicSupplyType,
  MosaicDefinitionTransaction,
  MosaicSupplyChangeTransaction,
} from "nem2-sdk";

export const nemMosaicService = {
  mosaicDefinitionTransaction(account: Account, mosaicProperties: MosaicProperties) {
    const nonce = MosaicNonce.createRandom();
    return MosaicDefinitionTransaction.create(
      Deadline.create(),
      nonce,
      MosaicId.createFromNonce(nonce, account.publicAccount),
      mosaicProperties,
      NetworkType.MIJIN_TEST
    );
  },

  mosaicSupplyChangeTransaction(mosaicId: MosaicId, direction: MosaicSupplyType, delta: UInt64) {
    return MosaicSupplyChangeTransaction.create(
      Deadline.create(),
      mosaicId,
      direction,
      delta,
      NetworkType.MIJIN_TEST
    );
  },
}