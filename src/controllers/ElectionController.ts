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
      return res.status(200).send({ data: "Elección creada exitosamente" });
    }
    catch (error) {
      console.log('error', error)
      return res.status(500).send({ data: { message: 'error' } });
    }
  }

  static associateCandidates = async (req: Request, res: Response) => {
    const { election, candidates } = req.body;
    const electoralEventPublicKey = req.params.electoralEventPublicKey;
    try {
      const response = await nemElection.associateCandidates(election, candidates, electoralEventPublicKey);
      if (!response.created) {
        return res.status(400).send({ data: { notValidCandidates: response.data, code: '00' } });
      }
      return res.status(200).send({ data: "Candidatos asociados exitosamente" });
    }
    catch (error) {
      console.log('error', error)
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

  static result = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.electoralEventPublicKey;
    const { election } = req.body;
    try {
      const result = await nemElection.result(electoralEventPublicKey, election);
      res.status(200).send(result);
    }
    catch (error) {
      console.log('error :', error);
      res.status(500).send("An error ocurred");
    }
  }
}

export default ElectionController;