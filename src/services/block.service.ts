import { BlockchainHttp } from "nem2-sdk";

export const nemBlockService = {
    async getBlockByHeight(height: number) {
        const blockchainHttp = new BlockchainHttp('http://54.178.241.129:3000');
        return blockchainHttp.getBlockByHeight(height).toPromise();
    }
}
