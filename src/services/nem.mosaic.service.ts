// modules
import {
  UInt64,
  Deadline,
  MosaicId,
  NetworkType,
  MosaicSupplyType,
  MosaicProperties,
  MosaicDefinitionTransaction,
  MosaicSupplyChangeTransaction,
} from "nem2-sdk";

export const nemMosaicService = {
  mosaicDefinitionTransaction(namespaceName: string, mosaicName: string, mosaicProperties: MosaicProperties) {
    return MosaicDefinitionTransaction.create(
      Deadline.create(),
      mosaicName,
      namespaceName,
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