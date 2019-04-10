// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { ElectoralEvent } from "../entities/ElectoralEvent";

// models

import { nemElectoralEvent } from "../models/nemElectoralEvent";
import { nemElectoralRegister } from "../models/nemElectoralRegister";

// services 

import { nemAccountService } from '../services/nem.account.service';

// others

class ElectoralEventController {

  static getAll = async (req: Request, res: Response) => {
    const electoralEventRepository = getRepository(ElectoralEvent);
    // buscar registros mas recientes
    try {
      let electoralEventsHash = await electoralEventRepository.find({
        skip: req.body.index,
        take: 10
      });
      const electoralEvents = await nemElectoralEvent.getAll(electoralEventsHash);

      res.status(200).send(electoralEvents);

    } catch (error) {
      console.log('error :', error.response.text);
      return res.status(500).send({ data: error.response.text });
    }
  }

  static get = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    const electoralEventTransaction = await nemElectoralEvent.exist(electoralEventPublicAccount);
    if(!electoralEventTransaction) {
      return res.status(400).send({ data: "Evento Electoral no existe" });
    }
    const electoralEvent = JSON.parse(electoralEventTransaction.message.payload).data
    return res.status(200).send(electoralEvent);
  }

  static create = async (req: Request, res: Response) => {
    const electoralEventData = req.body;
    try {
      const response = await nemElectoralEvent.create(electoralEventData);

      if (!response.created) {
        return res.status(400).send({ data: response.data });
      }

      const hash = response.data.electoralEventHashTransaction;
      let electoralEvent = new ElectoralEvent();
      electoralEvent.hash = hash;
      const electoralEventRepository = getRepository(ElectoralEvent);
      await electoralEventRepository.save(electoralEvent);

      return res.status(200).send({ data: "Electoral event successfully created" });
    }
    catch (error) {
      console.log(error);
      return res.status(500).send({ data: error });
    }
  }

  static registerHash = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey

    try {
      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
      const transactionElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);

      if (!transactionElectoralEvent) {
        return res.status(400).send({ data: "evento electoral no existe" });
      }

      const hash = transactionElectoralEvent.transactionInfo.hash;
      let electoralEvent = new ElectoralEvent();
      electoralEvent.hash = hash;
      const electoralEventRepository = getRepository(ElectoralEvent);
      await electoralEventRepository.save(electoralEvent);

      return res.status(200).send({ data: "Electoral event hash successfully register" });

    } catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static activate = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey
    try {
      const response = await nemElectoralEvent.activate(electoralEventPublicKey);
      if (!response.activated) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static finish = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    try {
      const response = await nemElectoralEvent.finish(electoralEventPublicKey);
      if (!response.finished) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static createElectoralRegister = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    try {
      const response = await nemElectoralRegister.storeElectoralRegister(electoralEventPublicKey);
      if (!response.created) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

}

export default ElectoralEventController;