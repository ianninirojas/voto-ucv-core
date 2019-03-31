import {
  MosaicId,
} from 'nem2-sdk';

// Profile stored correctly
// default->
//         Network:        MIJIN_TEST
//         Url:            http://localhost:3000
//         Address:        SACDCXI7K6OFGOFSDRISBMBBLTGL6AYBDQY3Q3A4
//         PublicKey:      92AFC1966C68DEDA90852972EB31B2E19DBB0AA5840862693F3D3EB967F9FC26
//         PrivateKey:     410887BF0E2B62BA03944E2BA61151A2A674DC8CAFC7C7A65C614CE6E7214A58

export const nemElectoralCommission = {

  getElectoralCommissionPrivateKey() {
    return '410887BF0E2B62BA03944E2BA61151A2A674DC8CAFC7C7A65C614CE6E7214A58';
  },

  getElectoralCommissionNamespace() {
    // nem2-cli transaction namespace --name commission-electoral --rootnamespace --duration 1000
    return 'commission-electoral';
  },

  getOfficialMosaicId() {
    // nem2-cli transaction mosaic --mosaicname voto --namespacename commission-electoral --amount 1000000 --transferable --supplymutable --divisibility 0 --duration 1000
    // nem2-cli transaction mosaic --amount 1000000 --transferable --supplymutable --divisibility 0 --duration 1000
    // Hex: 4f2aaf1342144fba
    // Uint64: [1108627386 1328197395]
    return new MosaicId([1108627386, 1328197395]);
  },

  //verificar que la transaccion tenga un token de la comision electoral
  validateTransaction(transaction: any) {
    const officialMosaicId = this.getOfficialMosaicId();
    for (const mosaic of transaction.mosaics) {
      if (officialMosaicId.id.equals(mosaic.id.id))
        return true;
    }
    return false;
  }
}