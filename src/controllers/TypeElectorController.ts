// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { TypeElector } from "../entities/TypeElector";
import { validate } from "class-validator";

class TypeElectorController {
  static getAll = async (req: Request, res: Response) => {
    try {
      const typeElectorRepository = getRepository(TypeElector);
      const typeElectors = await typeElectorRepository.find();
      res.status(200).send(typeElectors);
    }
    catch (error) {
      res.status(500).send("An error ocurred");
    }
  }

  static create = async (req: Request, res: Response) => {
    let { name } = req.body;
    let typeElector = new TypeElector();
    typeElector.name = name;

    const errors = await validate(typeElector);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      const typeElectorRepository = getRepository(TypeElector);
      await typeElectorRepository.save(typeElector);
    }
    catch (error) {
      res.status(409).send("name type elector alredy created");
    }

    return res.status(200).send("Type elector created")
  }

  static update = async (req: Request, res: Response) => {
    const id = req.params.id;
    let { name } = req.body;
    
    const typeElectorRepository = getRepository(TypeElector);
    let typeElector: TypeElector;
    try {
      typeElector = await typeElectorRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send("Type elector not found");
    }

    if (name !== undefined)
      typeElector.name = name;

    const errors = await validate(typeElector);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await typeElectorRepository.save(typeElector);
    } catch (e) {
      return res.status(409).send("name already in use");
    }
    res.status(204).send();
  }

  static delete = async (req: Request, res: Response) => {
    const id = req.params.id;

    const typeElectorRepository = getRepository(TypeElector);
    try {
      await typeElectorRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send("Type elector not found");
    }
    typeElectorRepository.delete(id);

    res.status(204).send();
  }

}

export default TypeElectorController;