// modules
import { Router } from "express";

// controllers
import ElectionController from "../controllers/ElectionController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/electoral-event/:electoralEventPublicKey/election", ElectionController.getAll);

router.post("/electoral-event/:electoralEventPublicKey/election/result", ElectionController.result);

router.post("/electoral-event/:electoralEventPublicKey/election", [checkJwt, checkRole(["ADMIN"])], ElectionController.create);

router.post("/electoral-event/:electoralEventPublicKey/election/:electionId", [checkJwt, checkRole(["ADMIN"])], ElectionController.associateCandidates);

export default router;