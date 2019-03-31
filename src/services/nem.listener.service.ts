// modules
import {
  Address,
  Listener,
} from 'nem2-sdk';

export class listenerService {
  listener: Listener
  constructor() {
    this.listener = new Listener('http://127.0.0.1:3000');
  }
  /**
   * open
   */
  public open() {
    return this.listener.open();
  }

  /**
   * terminate
   */
  public terminate() {
    this.listener.terminate();
  }

  /**
   * close
   */
  public close() {
    this.listener.close();
  }
  
  public newBlock() {
    return this.listener.newBlock()
  }
  
  public status(address: Address) {
    return this.listener.status(address);
  }

  public unconfirmedAdded(address: Address) {
    return this.listener.unconfirmedAdded(address);
  }

  public confirmed(address: Address) {
    return this.listener.confirmed(address);
  }

}