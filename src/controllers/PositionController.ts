// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { Position } from "../entities/Position";
import { validate } from "class-validator";

class PositionController {
  static getAll = async (req: Request, res: Response) => {
    try {
      const positionRepository = getRepository(Position);
      const positions = await positionRepository.find();
      res.status(200).send(positions);
    }
    catch (error) {
      res.status(500).send({ data: "An error ocurred" });
    }
  }

  static create = async (req: Request, res: Response) => {
    let { name } = req.body;
    let position = new Position();
    position.name = name.toLowerCase();

    const errors = await validate(position);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      const positionRepository = getRepository(Position);
      await positionRepository.save(position);
    }
    catch (error) {
      res.status(409).send({ data: "Position already created" });
    }

    return res.status(200).send({ data: "Cargo creado" })
  }

  static update = async (req: Request, res: Response) => {
    const id = req.params.id;
    let { name } = req.body;

    const positionRepository = getRepository(Position);
    let position: Position;
    try {
      position = await positionRepository.findOneOrFail(id);
    } catch (error) {
      console.log('error :', error);
      return res.status(404).send({ data: "Position not found" });
    }

    if (name !== undefined)
      position.name = name;

    const errors = await validate(position);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await positionRepository.save(position);
    } catch (e) {
      return res.status(409).send({ data: "name already in use" });
    }
    res.status(204).send();
  }

  static delete = async (req: Request, res: Response) => {
    const id = req.params.id;

    const positionRepository = getRepository(Position);
    try {
      await positionRepository.findOneOrFail(id);
    } catch (error) {
      return res.status(404).send({ data: "Position not found" });
    }
    positionRepository.delete(id);

    res.status(204).send();
  }

}

export default PositionController;