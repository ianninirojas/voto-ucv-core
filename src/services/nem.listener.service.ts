// modules
import {
  Address,
  Listener,
} from 'nem2-sdk';

export class listenerService {
  listener: Listener
  constructor() {
    this.listener = new Listener('http://54.178.241.129:3000');
  }

  public open() {
    return this.listener.open();
  }

  public terminate() {
    this.listener.terminate();
  }

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

  public isOpen() {
    return this.listener.isOpen()
  }

}