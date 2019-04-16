// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { TypeElection } from "../entities/TypeElection";
import { validate } from "class-validator";

class TypeElectionController {
  static getAll = async (req: Request, res: Response) => {
    try {
      const typeElectionRepository = getRepository(TypeElection);
      const typeElections = await typeElectionRepository.find();
      res.status(200).send(typeElections);
    }
    catch (error) {
      res.status(500).send({ data: "An error ocurred" });
    }
  }

  static create = async (req: Request, res: Response) => {
    let { name, levelElection } = req.body;
    let typeElection = new TypeElection();
    typeElection.name = name;
    typeElection.levelElection = levelElection;

    const errors = await validate(typeElection);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      const typeElectionRepository = getRepository(TypeElection);
      await typeElectionRepository.save(typeElection);
    }
    catch (error) {
      res.status(409).send({ data: "Type election alredy created" });
    }

    return res.status(200).send({ data: "Type election created" })
  }

  static update = async (req: Request, res: Response) => {
    const id = req.params.id;
    let { name, levelElection } = req.body;

    const typeElectionRepository = getRepository(TypeElection);
    let typeElection: TypeElection;
    try {
      typeElection = await typeElectionRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send({ data: "Type election not found" });
    }

    if (name !== undefined)
      typeElection.name = name;

    if (levelElection !== undefined)
      typeElection.levelElection = levelElection;

    const errors = await validate(typeElection);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await typeElectionRepository.save(typeElection);
    } catch (e) {
      return res.status(409).send({ data: "name already in use" });
    }
    res.status(204).send();
  }

  static delete = async (req: Request, res: Response) => {
    const id = req.params.id;

    const typeElectionRepository = getRepository(TypeElection);
    try {
      await typeElectionRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send("Type election not found");
    }
    typeElectionRepository.delete(id);

    res.status(204).send();
  }

}

export default TypeElectionController;