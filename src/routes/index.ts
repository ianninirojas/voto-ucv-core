import { Router } from "express";

import auth from "./auth";
import user from "./user";
import voter from "./voter";
import electoralEvent from "./electoralEvent";
import faculty from "./faculty";
import election from "./election";
import school from "./school";
import position from "./position";
import typeElection from "./typeElection";

const routes = Router();
routes.use(auth);
routes.use(user);
routes.use(voter);
routes.use(electoralEvent);
routes.use(election);
routes.use(faculty);
routes.use(school);
routes.use(position);
routes.use(typeElection);

export default routes;