import { Request, Response, NextFunction } from "express";

import * as jwt from "jsonwebtoken";

import { secrets } from "../config";

export const checkTokenVoter = (type: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = <string>req.headers["authorization"].split(' ')[1];
    let jwtPayload;
    try {
      jwtPayload = <any>jwt.verify(token, secrets.jwtSecret);
      req.body.jwtPayload = jwtPayload;
      const { identityDocument, typeCode, code } = jwtPayload;
      if (typeCode !== type)
        throw "no válido";

      if (!(identityDocument && code)) {
        throw 'faltan datos';
      }
    }
    catch (error) {
      res.status(401).send();
      return;
    }
    next();
  };
};