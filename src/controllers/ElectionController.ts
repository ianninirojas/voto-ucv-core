// modules
import { Request, Response } from "express";

// models
import { nemElection } from "../models/nemElection";

class ElectionController {

  static create = async (req: Request, res: Response) => {
    const electionData = req.body;
    const electoralEventPublicKey = req.params.electoralEventPublicKey;
    try {
      const response = await nemElection.create(electionData, electoralEventPublicKey);
      if (!response.created) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: "Election successfully created" });
    }
    catch (error) {
      return res.status(500).send({ data: { message: 'error' } });
    }
  }

  static getAll = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.electoralEventPublicKey;
    let electionIds = [];
    if (Object.keys(req.query).length !== 0) {
      for (const prop in req.query) {
        electionIds.push(req.query[prop]);
      }
    }
    try {
      let elections;

      if (electionIds.length > 0) {
        elections = await nemElection.getAll(electoralEventPublicKey, electionIds);
      }
      else {
        elections = await nemElection.getAll(electoralEventPublicKey);
      }

      res.status(200).send(elections);
    }
    catch (error) {
      console.log('error :', error);
      res.status(500).send("An error ocurred");
    }
  }

  static getByIds = async (req: Request, res: Response) => {
    const electoralEventData = req.body.electoralEventData;
    const electionsIds = req.body.electionsIds;
    try {
      const elections = await nemElection.getAll(electoralEventData, electionsIds);
      res.status(200).send(elections);
    }
    catch (error) {
      console.log('error :', error);
      res.status(500).send("An error ocurred");
    }
  }

}

export default ElectionController;