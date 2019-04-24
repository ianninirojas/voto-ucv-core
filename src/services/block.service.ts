import { BlockchainHttp } from "nem2-sdk";

import { env } from "../config";

export const nemBlockService = {
    async getBlockByHeight(height: number) {
        const blockchainHttp = new BlockchainHttp(env.apiNemUrl);
        return blockchainHttp.getBlockByHeight(height).toPromise();
    }
}
