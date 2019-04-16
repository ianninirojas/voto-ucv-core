// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { LevelElection } from "../entities/LevelElection";
import { validate } from "class-validator";

class LevelElectionController {
  static getAll = async (req: Request, res: Response) => {
    try {
      const levelElectionRepository = getRepository(LevelElection);
      const levelElections = await levelElectionRepository.find();
      res.status(200).send(levelElections);
    }
    catch (error) {
      res.status(500).send("An error ocurred");
    }
  }

  static create = async (req: Request, res: Response) => {
    let { level } = req.body;
    let levelElection = new LevelElection();
    levelElection.level = level;

    const errors = await validate(levelElection);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      const levelElectionRepository = getRepository(LevelElection);
      await levelElectionRepository.save(levelElection);
    }
    catch (error) {
      res.status(409).send("level election alredy created");
    }

    return res.status(200).send("Level election created")
  }

  static update = async (req: Request, res: Response) => {
    const id = req.params.id;
    let { level } = req.body;
    
    const levelElectionRepository = getRepository(LevelElection);
    let levelElection: LevelElection;
    try {
      levelElection = await levelElectionRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send("Level election not found");
    }

    if (level !== undefined)
      levelElection.level = level;

    const errors = await validate(levelElection);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await levelElectionRepository.save(levelElection);
    } catch (e) {
      return res.status(409).send("level already in use");
    }
    res.status(204).send();
  }

  static delete = async (req: Request, res: Response) => {
    const id = req.params.id;

    const levelElectionRepository = getRepository(LevelElection);
    try {
      await levelElectionRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send("Level election not found");
    }
    levelElectionRepository.delete(id);

    res.status(204).send();
  }

}

export default LevelElectionController;