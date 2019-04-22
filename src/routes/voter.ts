// modules
import { Router } from "express";

// controllers
import VoterController from "../controllers/VoterController";

// middlewares
import { checkTokenVoter } from "../middlewares/checkTokenVoter";

const router = Router();

router.get("/electoral-event/:electoralEventPublickey/voter/auth", [checkTokenVoter('auth')], VoterController.auth);

router.post("/electoral-event/:electoralEventPublickey/voter/access", [checkTokenVoter('access')], VoterController.access);

router.post("/electoral-event/:electoralEventPublickey/voter/login", [checkTokenVoter('login')], VoterController.login);

router.post("/electoral-event/:electoralEventPublickey/voter/vote", [checkTokenVoter('vote')], VoterController.vote);

export default router;