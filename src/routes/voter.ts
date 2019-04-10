// modules
import { Router } from "express";

// controllers
import VoterController from "../controllers/VoterController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";

const router = Router();

router.post("/electoral-event/:electoralEventPublickey/voter/auth", VoterController.auth);

router.post("/electoral-event/:electoralEventPublickey/voter/access", VoterController.access);

router.post("/electoral-event/:electoralEventPublickey/voter/login", VoterController.login);

router.post("/electoral-event/:electoralEventPublickey/voter/vote", VoterController.vote);

export default router;